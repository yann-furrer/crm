import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db, RentalContractStatus, VehicleStatus, VehicleType } from "@crm/db";
import { listRentalContracts, searchCrm } from "../agent/lib/lookup";

const suffix = process.env.TEST_RUN_ID ?? "lookup-spec";
const domain = `northwind-${suffix}.test`;
const otherDomain = `brightwater-${suffix}.test`;

let northwindId: string;
let brightwaterId: string;
let paulaId: string;
let peterId: string;
let vehicleIds: string[] = [];
let rentalContractId: string;
let freshRentalContractId: string;
let closedRentalContractId: string;

beforeAll(async () => {
	await cleanup();

	const user = await db.user.create({
		data: {
			id: `user-${suffix}`,
			name: "Rep One",
			email: `rep.${suffix}@example.test`,
			emailVerified: true,
			image: "https://cdn.example.test/rep-one.png",
		},
		select: { id: true },
	});

	const northwind = await db.company.create({
		data: {
			name: `Northwind ${suffix}`,
			domain,
			iconUrl: "https://cdn.example.test/northwind-icon.png",
			iconDarkUrl: "https://cdn.example.test/northwind-icon-dark.png",
			iconTone: "opaque",
			logoUrl: "https://cdn.example.test/northwind-logo.svg",
		},
		select: { id: true },
	});
	northwindId = northwind.id;

	const brightwater = await db.company.create({
		data: { name: `Brightwater ${suffix}`, domain: otherDomain },
		select: { id: true },
	});
	brightwaterId = brightwater.id;

	const paula = await db.contact.create({
		data: {
			firstName: "Paula",
			lastName: "Marchetti",
			title: "Growth Specialist",
			email: `paula.marchetti@${domain}`,
			companyId: northwindId,
			lastActivityAt: new Date(),
		},
		select: { id: true },
	});
	paulaId = paula.id;

	const peter = await db.contact.create({
		data: {
			firstName: "Peter",
			lastName: "Marchetti",
			title: "Controller",
			email: `peter.marchetti@${otherDomain}`,
			companyId: brightwaterId,
		},
		select: { id: true },
	});
	peterId = peter.id;

	const vehicle = await db.vehicle.create({
		data: {
			type: VehicleType.MINIBUS,
			make: "Toyota",
			model: "Hiace",
			plateNumber: `RENEW-${suffix}`,
			status: VehicleStatus.RENTED,
			dailyRate: 40_000,
			currency: "XOF",
			ownerId: user.id,
		},
		select: { id: true },
	});
	vehicleIds.push(vehicle.id);

	const freshVehicle = await db.vehicle.create({
		data: {
			type: VehicleType.CAR,
			make: "Hyundai",
			model: "Accent",
			plateNumber: `FRESH-${suffix}`,
			status: VehicleStatus.RESERVED,
			dailyRate: 25_000,
			currency: "XOF",
			ownerId: user.id,
		},
		select: { id: true },
	});
	vehicleIds.push(freshVehicle.id);

	const closedVehicle = await db.vehicle.create({
		data: {
			type: VehicleType.CAR,
			make: "Kia",
			model: "Rio",
			plateNumber: `CLOSED-${suffix}`,
			status: VehicleStatus.AVAILABLE,
			dailyRate: 20_000,
			currency: "XOF",
			ownerId: user.id,
		},
		select: { id: true },
	});
	vehicleIds.push(closedVehicle.id);

	const rentalContract = await db.rentalContract.create({
		data: {
			vehicleId: vehicle.id,
			contactId: paulaId,
			ownerId: user.id,
			status: RentalContractStatus.ACTIVE,
			startDate: new Date("2026-06-01T08:00:00.000Z"),
			endDate: new Date("2026-06-10T08:00:00.000Z"),
			pricePerDay: 40_000,
			currency: "XOF",
			totalAmount: 12_000,
			depositAmount: 5_000,
			depositCurrency: "XOF",
			lastActivityAt: new Date("2026-06-01T12:00:00.000Z"),
		},
		select: { id: true },
	});
	rentalContractId = rentalContract.id;

	const freshRentalContract = await db.rentalContract.create({
		data: {
			vehicleId: freshVehicle.id,
			contactId: paulaId,
			ownerId: user.id,
			status: RentalContractStatus.RESERVED,
			startDate: new Date("2026-08-04T08:00:00.000Z"),
			endDate: new Date("2026-08-11T08:00:00.000Z"),
			pricePerDay: 25_000,
			currency: "XOF",
			totalAmount: 8_000,
			depositAmount: 5_000,
			depositCurrency: "XOF",
			lastActivityAt: new Date("2026-08-04T12:00:00.000Z"),
		},
		select: { id: true },
	});
	freshRentalContractId = freshRentalContract.id;

	const closedRentalContract = await db.rentalContract.create({
		data: {
			vehicleId: closedVehicle.id,
			contactId: peterId,
			ownerId: user.id,
			status: RentalContractStatus.CANCELLED,
			startDate: new Date("2026-05-01T08:00:00.000Z"),
			endDate: new Date("2026-05-05T08:00:00.000Z"),
			pricePerDay: 20_000,
			currency: "XOF",
			totalAmount: 6_000,
			depositAmount: 5_000,
			depositCurrency: "XOF",
			cancelledAt: new Date("2026-05-02T12:00:00.000Z"),
			cancelledReason: "Client cancelled",
			lastActivityAt: new Date("2026-05-01T12:00:00.000Z"),
		},
		select: { id: true },
	});
	closedRentalContractId = closedRentalContract.id;
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	const companies = await db.company.findMany({
		where: { domain: { in: [domain, otherDomain] } },
		select: { id: true },
	});
	const ids = companies.map((company) => company.id);

	if (ids.length > 0) {
		await db.activity.deleteMany({ where: { companyId: { in: ids } } });
	}
	if (vehicleIds.length > 0) {
		await db.rentalContract.deleteMany({
			where: { vehicleId: { in: vehicleIds } },
		});
		await db.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
	}
	if (ids.length > 0) {
		await db.contact.deleteMany({ where: { companyId: { in: ids } } });
		await db.company.deleteMany({ where: { id: { in: ids } } });
	}

	await db.user.deleteMany({ where: { email: `rep.${suffix}@example.test` } });
	vehicleIds = [];
}

describe("searchCrm", () => {
	it("finds a company by name", async () => {
		const result = await searchCrm(`Northwind ${suffix}`);

		expect(result.companies[0]?.id).toBe(northwindId);
		expect(result.companies[0]?.contacts).toBe(1);
	});

	it("finds the people at a company named in the query", async () => {
		const result = await searchCrm(`Northwind ${suffix}`);

		expect(result.contacts.map((hit) => hit.id)).toContain(paulaId);
	});

	it("returns both people behind an ambiguous surname", async () => {
		const result = await searchCrm("Marchetti");

		expect(result.contacts.map((hit) => hit.id).sort()).toEqual(
			[paulaId, peterId].sort(),
		);
		expect(result.contacts.every((hit) => hit.company !== null)).toBe(true);
		expect(result.contacts.map((hit) => hit.title)).toContain("Controller");
	});

	it("finds a person by their address, and the company on its domain", async () => {
		const result = await searchCrm(`paula.marchetti@${domain}`);

		expect(result.contacts[0]?.id).toBe(paulaId);
		expect(result.companies[0]?.id).toBe(northwindId);
	});

	it("treats a bare domain as the company", async () => {
		const result = await searchCrm(domain);

		expect(result.companies[0]?.id).toBe(northwindId);
	});

	it("finds a rental contract by vehicle plate", async () => {
		const result = await searchCrm(`RENEW-${suffix}`);

		expect(result.rentalContracts[0]?.id).toBe(rentalContractId);
		expect(result.rentalContracts[0]?.totalAmount).toBe(12_000);
	});

	it("narrows to the kinds asked for", async () => {
		const result = await searchCrm(`Northwind ${suffix}`, {
			kinds: ["contact"],
		});

		expect(result.companies).toHaveLength(0);
		expect(result.rentalContracts).toHaveLength(0);
		expect(result.contacts.length).toBeGreaterThan(0);
	});

	it("finds nothing rather than guessing", async () => {
		const result = await searchCrm("zzyzxqqq");

		expect(result.total).toBe(0);
	});

	it("ranks a whole-phrase match above rows sharing only one word", async () => {
		const result = await searchCrm(`Paula Marchetti`);

		expect(result.contacts[0]?.id).toBe(paulaId);
	});

	it("refuses a query too short to mean anything", async () => {
		expect((await searchCrm("a")).total).toBe(0);
	});
});

describe("listRentalContracts", () => {
	it("lists stale open rental contracts across the fleet", async () => {
		const result = await listRentalContracts({
			status: "open",
			inactiveForDays: 14,
			now: new Date("2026-08-05T12:00:00.000Z"),
		});
		const ids = result.rentalContracts.map((contract) => contract.id);

		expect(ids).toContain(rentalContractId);
		expect(ids).not.toContain(freshRentalContractId);
		expect(ids).not.toContain(closedRentalContractId);
		expect(
			result.rentalContracts.find(
				(contract) => contract.id === rentalContractId,
			),
		).toMatchObject({
			daysSinceLastActivity: 65,
			neverActive: false,
			vehicle: `Toyota Hiace (RENEW-${suffix})`,
			owner: { image: "https://cdn.example.test/rep-one.png" },
		});
	});

	it("paginates a broad fleet sweep without repeating a row", async () => {
		const first = await listRentalContracts({ status: "all", limit: 1 });
		expect(first.hasMore).toBe(true);
		expect(first.nextCursor).toBeTruthy();

		const second = await listRentalContracts({
			status: "all",
			limit: 1,
			cursor: first.nextCursor ?? undefined,
		});
		expect(second.rentalContracts[0]?.id).not.toBe(
			first.rentalContracts[0]?.id,
		);
	});
});
