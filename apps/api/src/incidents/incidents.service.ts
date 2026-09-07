import {
	type Db,
	InsuranceClaimStatus,
	type Prisma,
	Prisma as PrismaNamespace,
	ResponsibleParty,
} from "@crm/db";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { decimalFromCents, parseDate, toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import type {
	IncidentCreateInput,
	IncidentUpdateInput,
} from "./incidents.contracts";

const REPORTED_BY_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const SELECT = {
	id: true,
	vehicleId: true,
	rentalContractId: true,
	type: true,
	reportedAt: true,
	reportedBy: { select: REPORTED_BY_SELECT },
	description: true,
	responsibleParty: true,
	insuranceClaimNumber: true,
	insuranceStatus: true,
	estimatedCost: true,
	actualCost: true,
	currency: true,
	policeReportReference: true,
	photoUrls: true,
	resolvedAt: true,
	notes: true,
	createdAt: true,
} as const;

@Injectable()
export class IncidentsService {
	private readonly logger = new Logger(IncidentsService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async listByVehicle(vehicleId: string) {
		const rows = await this.db.incident.findMany({
			where: { vehicleId },
			orderBy: { reportedAt: "desc" },
			select: SELECT,
		});
		return rows.map(serialize);
	}

	async listByContract(rentalContractId: string) {
		const rows = await this.db.incident.findMany({
			where: { rentalContractId },
			orderBy: { reportedAt: "desc" },
			select: SELECT,
		});
		return rows.map(serialize);
	}

	async create(input: IncidentCreateInput, reportedById: string) {
		try {
			const incident = await this.db.incident.create({
				data: {
					vehicleId: input.vehicleId,
					rentalContractId: input.rentalContractId ?? null,
					type: input.type,
					reportedAt: parseDate(input.reportedAt) ?? new Date(),
					reportedById,
					description: input.description.trim(),
					responsibleParty: input.responsibleParty ?? ResponsibleParty.UNKNOWN,
					insuranceClaimNumber: input.insuranceClaimNumber ?? null,
					insuranceStatus:
						input.insuranceStatus ?? InsuranceClaimStatus.NOT_FILED,
					estimatedCost: decimalFromCents(input.estimatedCostCents),
					currency: input.currency ?? null,
					policeReportReference: input.policeReportReference ?? null,
					notes: input.notes ?? null,
				},
				select: { id: true, vehicleId: true, type: true },
			});

			this.logger.log({
				message: "Incident reported",
				incidentId: incident.id,
				vehicleId: incident.vehicleId,
				type: incident.type,
			});

			return incident;
		} catch (error) {
			throw this.translate(error, input.vehicleId);
		}
	}

	async update(id: string, input: IncidentUpdateInput) {
		try {
			return await this.db.incident.update({
				where: { id },
				data: {
					responsibleParty: input.responsibleParty,
					insuranceClaimNumber: input.insuranceClaimNumber,
					insuranceStatus: input.insuranceStatus,
					estimatedCost:
						input.estimatedCostCents === undefined
							? undefined
							: decimalFromCents(input.estimatedCostCents),
					actualCost:
						input.actualCostCents === undefined
							? undefined
							: decimalFromCents(input.actualCostCents),
					policeReportReference: input.policeReportReference,
					resolvedAt:
						input.resolvedAt === undefined
							? undefined
							: parseDate(input.resolvedAt),
					notes: input.notes,
				},
				select: { id: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async delete(id: string): Promise<{ id: string }> {
		try {
			await this.db.incident.delete({ where: { id } });
		} catch (error) {
			throw this.translate(error, id);
		}

		return { id };
	}

	private translate(error: unknown, id: string): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No incident with id ${id}.`);
		}
		return error;
	}
}

type IncidentRow = Prisma.IncidentGetPayload<{ select: typeof SELECT }>;

function serialize({
	estimatedCost,
	actualCost,
	reportedAt,
	resolvedAt,
	createdAt,
	...rest
}: IncidentRow) {
	return {
		...rest,
		estimatedCostCents: toCents(estimatedCost),
		actualCostCents: toCents(actualCost),
		reportedAt: reportedAt.toISOString(),
		resolvedAt: resolvedAt?.toISOString() ?? null,
		createdAt: createdAt.toISOString(),
	};
}
