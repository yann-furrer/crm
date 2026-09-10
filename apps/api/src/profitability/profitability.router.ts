import { Inject } from "@nestjs/common";
import { Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	profitabilityByVehicleInput,
	profitabilitySummaryInput,
} from "./profitability.contracts";
import { ProfitabilityService } from "./profitability.service";

@Router({ alias: "profitability" })
@UseMiddlewares(AuthMiddleware)
export class ProfitabilityRouter {
	constructor(
		@Inject(ProfitabilityService)
		private readonly profitability: ProfitabilityService,
	) {}

	@Query({ input: profitabilitySummaryInput })
	async summary() {
		return this.profitability.summary();
	}

	@Query({ input: profitabilityByVehicleInput })
	async byVehicle(@Input("vehicleId") vehicleId: string) {
		return this.profitability.byVehicle(vehicleId);
	}
}
