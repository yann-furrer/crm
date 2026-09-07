import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { IncidentsRouter } from "./incidents.router";
import { IncidentsService } from "./incidents.service";

@Module({
	imports: [TrpcModule],
	providers: [IncidentsService, IncidentsRouter],
	exports: [IncidentsService],
})
export class IncidentsModule {}
