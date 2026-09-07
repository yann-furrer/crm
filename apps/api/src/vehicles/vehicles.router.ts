import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	vehicleBulkInput,
	vehicleBulkOwnerInput,
	vehicleBulkStatusInput,
	vehicleCreateInput,
	vehicleIdInput,
	vehicleListInput,
	vehicleUpdateArgs,
} from "./vehicles.contracts";
import { VehiclesService } from "./vehicles.service";

@Router({ alias: "vehicles" })
@UseMiddlewares(AuthMiddleware)
export class VehiclesRouter {
	constructor(
		@Inject(VehiclesService) private readonly vehicles: VehiclesService,
	) {}

	@Query({ input: vehicleListInput })
	async list(@Input() input: z.infer<typeof vehicleListInput>) {
		return this.vehicles.list(input);
	}

	@Query({ input: vehicleIdInput })
	async byId(@Input("id") id: string) {
		return this.vehicles.byId(id);
	}

	@Mutation({ input: vehicleCreateInput })
	async create(@Input() input: z.infer<typeof vehicleCreateInput>) {
		return this.vehicles.create(input);
	}

	@Mutation({ input: vehicleUpdateArgs })
	async update(@Input() input: z.infer<typeof vehicleUpdateArgs>) {
		return this.vehicles.update(input.id, input.data);
	}

	@Mutation({ input: vehicleIdInput })
	async delete(@Input("id") id: string) {
		return this.vehicles.delete(id);
	}

	@Mutation({ input: vehicleBulkOwnerInput })
	async bulkAssignOwner(@Input() input: z.infer<typeof vehicleBulkOwnerInput>) {
		return this.vehicles.bulkAssignOwner(input);
	}

	@Mutation({ input: vehicleBulkStatusInput })
	async bulkSetStatus(@Input() input: z.infer<typeof vehicleBulkStatusInput>) {
		return this.vehicles.bulkSetStatus(input);
	}

	@Mutation({ input: vehicleBulkInput })
	async bulkDelete(@Input("ids") ids: string[]) {
		return this.vehicles.bulkDelete(ids);
	}
}
