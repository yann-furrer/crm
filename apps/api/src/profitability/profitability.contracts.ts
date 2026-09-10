import { z } from "zod";

export const profitabilitySummaryInput = z.object({});

export const profitabilityByVehicleInput = z.object({
	vehicleId: z.string(),
});
