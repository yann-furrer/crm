import { type Db, PaymentStatus, PaymentType } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { MONTH_LABEL, monthKey, monthStart } from "../dashboard/month-bucket";
import { InjectDatabase } from "../database/database.constants";

const TREND_MONTHS = 6;

const NON_REVENUE_PAYMENT_TYPES: PaymentType[] = [
	PaymentType.DEPOSIT,
	PaymentType.DEPOSIT_REFUND,
];

export type ProfitabilityBucket = {
	month: string;
	revenueCents: number;
	expensesCents: number;
	netCents: number;
};

export type ProfitabilitySummary = {
	reportingCurrency: string;
	lifetime: { revenueCents: number; expensesCents: number; netCents: number };
	trend: ProfitabilityBucket[];
};

export type ProfitabilityByVehicle = ProfitabilitySummary & {
	expenseBreakdown: {
		financingCents: number;
		chargesCents: number;
		maintenanceCents: number;
		incidentsCents: number;
	};
};

type Scope = { vehicleId?: string };

type Accumulator = {
	lifetime: number;
	buckets: number[];
};

@Injectable()
export class ProfitabilityService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async summary(): Promise<ProfitabilitySummary> {
		return this.compute({});
	}

	async byVehicle(vehicleId: string): Promise<ProfitabilityByVehicle> {
		return this.compute({ vehicleId });
	}

	private async compute(scope: Scope): Promise<ProfitabilityByVehicle> {
		const base = await this.conversion.reportingCurrency();
		const now = new Date();
		const trendStart = monthStart(now, -(TREND_MONTHS - 1));
		const firstBucket = monthKey(trendStart);

		const empty = (): Accumulator => ({
			lifetime: 0,
			buckets: Array.from({ length: TREND_MONTHS }, () => 0),
		});

		const add = (acc: Accumulator, month: Date, cents: number) => {
			acc.lifetime += cents;
			const index = monthKey(month) - firstBucket;
			if (index >= 0 && index < TREND_MONTHS) {
				acc.buckets[index] = (acc.buckets[index] ?? 0) + cents;
			}
		};

		const revenue = empty();
		const financing = empty();
		const charges = empty();
		const maintenance = empty();
		const incidents = empty();

		const payments = await this.db.payment.findMany({
			where: {
				status: PaymentStatus.COMPLETED,
				type: { notIn: NON_REVENUE_PAYMENT_TYPES },
				...(scope.vehicleId
					? { rentalContract: { vehicleId: scope.vehicleId } }
					: {}),
			},
			select: {
				baseAmount: true,
				baseCurrency: true,
				paidAt: true,
				createdAt: true,
			},
		});
		for (const payment of payments) {
			if (payment.baseCurrency !== base) continue;
			const cents = toCents(payment.baseAmount) ?? 0;
			add(revenue, payment.paidAt ?? payment.createdAt, cents);
		}

		const financingPlans = await this.db.vehicleFinancing.findMany({
			where: scope.vehicleId ? { vehicleId: scope.vehicleId } : {},
			select: {
				baseAmount: true,
				baseCurrency: true,
				startDate: true,
				termMonths: true,
			},
		});
		for (const plan of financingPlans) {
			if (plan.baseCurrency !== base) continue;
			const cents = toCents(plan.baseAmount) ?? 0;
			const lastMonth = plan.termMonths
				? monthKey(plan.startDate) + plan.termMonths - 1
				: monthKey(now);
			const elapsedMonths =
				Math.min(monthKey(now), lastMonth) - monthKey(plan.startDate) + 1;
			financing.lifetime += Math.max(0, elapsedMonths) * cents;

			for (let index = 0; index < TREND_MONTHS; index++) {
				const bucketKey = firstBucket + index;
				if (bucketKey < monthKey(plan.startDate) || bucketKey > lastMonth) {
					continue;
				}
				financing.buckets[index] = (financing.buckets[index] ?? 0) + cents;
			}
		}

		const vehicleCharges = await this.db.vehicleCharge.findMany({
			where: scope.vehicleId ? { vehicleId: scope.vehicleId } : {},
			select: {
				baseAmount: true,
				baseCurrency: true,
				frequency: true,
				startDate: true,
				endDate: true,
			},
		});
		for (const charge of vehicleCharges) {
			if (charge.baseCurrency !== base) continue;
			const cents = toCents(charge.baseAmount) ?? 0;

			if (charge.frequency === "ONE_TIME") {
				add(charges, charge.startDate, cents);
				continue;
			}

			const lastMonth = monthKey(charge.endDate ?? now);
			const elapsedMonths =
				Math.min(monthKey(now), lastMonth) - monthKey(charge.startDate) + 1;
			charges.lifetime += Math.max(0, elapsedMonths) * cents;

			for (let index = 0; index < TREND_MONTHS; index++) {
				const bucketKey = firstBucket + index;
				if (bucketKey < monthKey(charge.startDate) || bucketKey > lastMonth) {
					continue;
				}
				charges.buckets[index] = (charges.buckets[index] ?? 0) + cents;
			}
		}

		const maintenanceRecords = await this.db.maintenanceRecord.findMany({
			where: {
				completedAt: { not: null },
				cost: { not: null },
				...(scope.vehicleId ? { vehicleId: scope.vehicleId } : {}),
			},
			select: { cost: true, currency: true, completedAt: true },
		});
		for (const record of maintenanceRecords) {
			if (!record.completedAt || !record.currency) continue;
			const converted = await this.conversion.convert(
				record.cost,
				record.currency,
			);
			if (!converted) continue;
			add(maintenance, record.completedAt, toCents(converted.baseAmount) ?? 0);
		}

		const incidentRows = await this.db.incident.findMany({
			where: {
				actualCost: { not: null },
				...(scope.vehicleId ? { vehicleId: scope.vehicleId } : {}),
			},
			select: {
				actualCost: true,
				currency: true,
				resolvedAt: true,
				reportedAt: true,
			},
		});
		for (const incident of incidentRows) {
			if (!incident.currency) continue;
			const converted = await this.conversion.convert(
				incident.actualCost,
				incident.currency,
			);
			if (!converted) continue;
			add(
				incidents,
				incident.resolvedAt ?? incident.reportedAt,
				toCents(converted.baseAmount) ?? 0,
			);
		}

		const expensesLifetime =
			financing.lifetime +
			charges.lifetime +
			maintenance.lifetime +
			incidents.lifetime;

		const trend: ProfitabilityBucket[] = Array.from(
			{ length: TREND_MONTHS },
			(_, index) => {
				const revenueCents = revenue.buckets[index] ?? 0;
				const expensesCents =
					(financing.buckets[index] ?? 0) +
					(charges.buckets[index] ?? 0) +
					(maintenance.buckets[index] ?? 0) +
					(incidents.buckets[index] ?? 0);
				return {
					month: MONTH_LABEL.format(monthStart(trendStart, index)),
					revenueCents,
					expensesCents,
					netCents: revenueCents - expensesCents,
				};
			},
		);

		return {
			reportingCurrency: base,
			lifetime: {
				revenueCents: revenue.lifetime,
				expensesCents: expensesLifetime,
				netCents: revenue.lifetime - expensesLifetime,
			},
			trend,
			expenseBreakdown: {
				financingCents: financing.lifetime,
				chargesCents: charges.lifetime,
				maintenanceCents: maintenance.lifetime,
				incidentsCents: incidents.lifetime,
			},
		};
	}
}
