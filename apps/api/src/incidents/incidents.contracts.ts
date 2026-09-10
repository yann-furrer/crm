import {
	IncidentDepositOutcome,
	IncidentDocumentType,
	IncidentType,
	InsuranceClaimStatus,
	ResponsibleParty,
} from "@crm/db";
import { z } from "zod";
import {
	currencyCode,
	optionalAmountCents,
} from "../currency/currency.contracts";

const typeEnum = z.enum(
	Object.values(IncidentType) as [IncidentType, ...IncidentType[]],
);

const responsiblePartyEnum = z.enum(
	Object.values(ResponsibleParty) as [ResponsibleParty, ...ResponsibleParty[]],
);

const insuranceStatusEnum = z.enum(
	Object.values(InsuranceClaimStatus) as [
		InsuranceClaimStatus,
		...InsuranceClaimStatus[],
	],
);

const depositOutcomeEnum = z.enum(
	Object.values(IncidentDepositOutcome) as [
		IncidentDepositOutcome,
		...IncidentDepositOutcome[],
	],
);

export const incidentDocumentTypeEnum = z.enum(
	Object.values(IncidentDocumentType) as [
		IncidentDocumentType,
		...IncidentDocumentType[],
	],
);

export const incidentsByVehicleInput = z.object({ vehicleId: z.string() });

export const incidentsByContractInput = z.object({
	rentalContractId: z.string(),
});

export const incidentCreateInput = z.object({
	vehicleId: z.string().min(1, "An incident belongs to a vehicle."),
	rentalContractId: z.string().nullable().optional(),
	type: typeEnum,
	description: z.string().trim().min(1, "Describe what happened."),
	reportedAt: z.string().nullable().optional(),
	responsibleParty: responsiblePartyEnum.optional(),
	insuranceClaimNumber: z.string().trim().nullable().optional(),
	insuranceStatus: insuranceStatusEnum.optional(),
	depositOutcome: depositOutcomeEnum.optional(),
	depositDeductedAmountCents: optionalAmountCents,
	depositCurrency: currencyCode.nullable().optional(),
	estimatedCostCents: optionalAmountCents,
	currency: currencyCode.nullable().optional(),
	policeReportReference: z.string().trim().nullable().optional(),
	notes: z.string().trim().nullable().optional(),
});

export type IncidentCreateInput = z.infer<typeof incidentCreateInput>;

const incidentUpdateInput = z.object({
	responsibleParty: responsiblePartyEnum.optional(),
	insuranceClaimNumber: z.string().trim().nullable().optional(),
	insuranceStatus: insuranceStatusEnum.optional(),
	depositOutcome: depositOutcomeEnum.optional(),
	depositDeductedAmountCents: optionalAmountCents,
	depositCurrency: currencyCode.nullable().optional(),
	estimatedCostCents: optionalAmountCents,
	actualCostCents: optionalAmountCents,
	policeReportReference: z.string().trim().nullable().optional(),
	resolvedAt: z.string().nullable().optional(),
	notes: z.string().trim().nullable().optional(),
});

export type IncidentUpdateInput = z.infer<typeof incidentUpdateInput>;

export const incidentUpdateArgs = z.object({
	id: z.string(),
	data: incidentUpdateInput,
});

export const incidentIdInput = z.object({ id: z.string() });

export const incidentDocumentMetaInput = z.object({
	type: incidentDocumentTypeEnum,
	amountCents: optionalAmountCents,
	currency: currencyCode.nullable().optional(),
	insuranceReimbursedAmountCents: optionalAmountCents,
});

export const incidentDocumentUploadInput = incidentDocumentMetaInput.extend({
	amountCents: z.number().int().nonnegative().optional(),
	insuranceReimbursedAmountCents: z.number().int().nonnegative().optional(),
});

export type IncidentDocumentMetaInput = z.infer<
	typeof incidentDocumentMetaInput
>;
export type IncidentDocumentUploadInput = z.infer<
	typeof incidentDocumentUploadInput
>;
