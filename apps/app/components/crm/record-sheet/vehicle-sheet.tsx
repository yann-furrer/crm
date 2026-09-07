"use client";

import Calendar from "@carbon/icons-react/es/Calendar";
import ToolKit from "@carbon/icons-react/es/ToolKit";
import Warning from "@carbon/icons-react/es/Warning";
import type { FieldValueJson } from "@crm/db/fields";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { EntityLogo } from "@crm/ui/components/entity-logo";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { Textarea } from "@crm/ui/components/textarea";
import { formatMoney } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { AgentPanel } from "@/components/crm/agent-panel";
import { FieldsCog, RecordFields } from "@/components/crm/fields/record-fields";
import {
	InlineDateField,
	InlineField,
	InlineSelectField,
	savingValue,
} from "@/components/crm/inline-field";
import { OwnerCell } from "@/components/crm/owner-cell";
import { RentalStatusIndicator } from "@/components/crm/rental-status";
import { Timeline } from "@/components/crm/timeline/timeline";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetProperties,
	DetailSheetSection,
	DetailSheetStat,
	DetailSheetStats,
	type DetailSheetTab,
} from "@/components/detail-sheet";
import { LocalDay } from "@/components/local-date-time";
import { savingField } from "@/lib/pending-field";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { QuickAddForm } from "./quick-add";
import { RecordActions } from "./record-actions";
import { RecordSheetFrame } from "./record-parts";
import { useOpenRecord, useRecordSheetView } from "./record-stack";

type Vehicle = RouterOutputs["vehicles"]["byId"];

const VEHICLE_TYPE_OPTIONS = [
	{ value: "CAR", label: "Car" },
	{ value: "MOTORCYCLE", label: "Motorcycle" },
	{ value: "SCOOTER", label: "Scooter" },
	{ value: "TRUCK", label: "Truck" },
	{ value: "MINIBUS", label: "Minibus" },
];

const VEHICLE_STATUS_OPTIONS = [
	{ value: "AVAILABLE", label: "Available" },
	{ value: "RESERVED", label: "Reserved" },
	{ value: "RENTED", label: "Rented" },
	{ value: "MAINTENANCE", label: "Maintenance" },
	{ value: "OUT_OF_SERVICE", label: "Out of service" },
	{ value: "STOLEN", label: "Stolen" },
];

const CONTRACT_COLUMNS = [
	{ id: "renter", header: "Renter", width: "w-[28%]", className: "pl-5" },
	{ id: "status", header: "Status", width: "w-[18%]" },
	{ id: "dates", header: "Dates", width: "w-[28%]" },
	{
		id: "amount",
		header: "Amount",
		width: "w-[16%]",
		align: "right" as const,
	},
];

const MAINTENANCE_COLUMNS = [
	{ id: "description", header: "Work", width: "w-[34%]", className: "pl-5" },
	{ id: "when", header: "When", width: "w-[22%]" },
	{
		id: "odometer",
		header: "Odometer",
		width: "w-[18%]",
		align: "right" as const,
	},
	{ id: "cost", header: "Cost", width: "w-[16%]", align: "right" as const },
];

const INCIDENT_COLUMNS = [
	{ id: "type", header: "Type", width: "w-[16%]", className: "pl-5" },
	{ id: "description", header: "Description", width: "w-[34%]" },
	{ id: "responsible", header: "Responsible", width: "w-[16%]" },
	{ id: "insurance", header: "Insurance", width: "w-[16%]" },
];

export function VehicleSheet({ vehicleId }: { vehicleId: string }) {
	const trpc = useTRPC();
	const { tab, setTab } = useRecordSheetView("overview");

	const query = useQuery(trpc.vehicles.byId.queryOptions({ id: vehicleId }));
	const vehicle = query.data;

	const tabs: DetailSheetTab[] = vehicle
		? [
				{
					value: "overview",
					label: "Overview",
					content: <VehicleOverview vehicle={vehicle} />,
				},
				{
					value: "history",
					label: "Rental history",
					content: <VehicleRentalHistory vehicleId={vehicle.id} />,
				},
				{
					value: "maintenance",
					label: "Maintenance",
					content: <VehicleMaintenance vehicleId={vehicle.id} />,
				},
				{
					value: "incidents",
					label: "Incidents",
					content: <VehicleIncidents vehicleId={vehicle.id} />,
				},
				{
					value: "activity",
					label: "Activity",
					content: <Timeline anchor={{ vehicleId: vehicle.id }} />,
				},
				{
					value: "agent",
					label: "Agent",
					content: <AgentPanel record={{ kind: "vehicle", id: vehicle.id }} />,
					keepMounted: true,
				},
			]
		: [];

	return (
		<RecordSheetFrame
			loading={query.isPending}
			error={query.error?.message ?? null}
			title={vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehicle"}
			description={vehicle?.plateNumber}
			media={
				vehicle ? <EntityLogo name={vehicle.plateNumber} size="lg" /> : null
			}
			actions={
				vehicle ? (
					<RecordActions
						record={{ kind: "vehicle", id: vehicle.id }}
						name={`${vehicle.make} ${vehicle.model}`}
						consequence="Its rental history, maintenance record and incidents go too."
					/>
				) : null
			}
			stats={
				vehicle ? (
					<DetailSheetStats>
						<DetailSheetStat label="Status">
							<StatusIndicator
								tone={
									vehicle.status === "AVAILABLE"
										? "success"
										: vehicle.status === "RENTED" ||
												vehicle.status === "RESERVED"
											? "info"
											: vehicle.status === "STOLEN"
												? "error"
												: "warning"
								}
								label={
									VEHICLE_STATUS_OPTIONS.find((o) => o.value === vehicle.status)
										?.label ?? vehicle.status
								}
							/>
						</DetailSheetStat>
						<DetailSheetStat label="Daily rate">
							{vehicle.dailyRateCents === null ? (
								<EmptyCellValue />
							) : (
								<span className="tabular-nums">
									{formatMoney(vehicle.dailyRateCents, vehicle.currency)}
								</span>
							)}
						</DetailSheetStat>
						<DetailSheetStat label="Mileage">
							<span className="tabular-nums">
								{vehicle.mileage.toLocaleString()} km
							</span>
						</DetailSheetStat>
						<DetailSheetStat label="Owner">
							<OwnerCell owner={vehicle.owner} />
						</DetailSheetStat>
					</DetailSheetStats>
				) : null
			}
			tabs={tabs}
			tab={tab}
			onTabChange={setTab}
		/>
	);
}

function VehicleOverview({ vehicle }: { vehicle: Vehicle }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const users = useQuery(trpc.users.list.queryOptions());

	const update = useMutation(
		trpc.vehicles.update.mutationOptions({
			onSuccess: () => cache.vehicle(vehicle.id, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const saveFields = (fields: Record<string, FieldValueJson>) =>
		update.mutate({ id: vehicle.id, data: { fields } });

	const isSavingField = savingValue(update);
	const isSaving = savingField(update);

	const save = (data: Parameters<typeof update.mutate>[0]["data"]) =>
		update.mutate({ id: vehicle.id, data });

	return (
		<DetailSheetBody>
			<DetailSheetSection title="Details" action={<FieldsCog kind="vehicle" />}>
				<DetailSheetProperties>
					<InlineSelectField
						label="Type"
						value={vehicle.type}
						options={VEHICLE_TYPE_OPTIONS}
						onSave={(type) => save({ type: type as never })}
					/>
					<InlineField
						label="Make"
						value={vehicle.make}
						saving={isSaving("make")}
						onSave={(make) => make && save({ make })}
					/>
					<InlineField
						label="Model"
						value={vehicle.model}
						saving={isSaving("model")}
						onSave={(model) => model && save({ model })}
					/>
					<InlineField
						label="Year"
						value={vehicle.year === null ? null : String(vehicle.year)}
						saving={isSaving("year")}
						onSave={(next) => save({ year: next ? Number(next) : null })}
					/>
					<InlineField
						label="Plate number"
						value={vehicle.plateNumber}
						saving={isSaving("plateNumber")}
						onSave={(plateNumber) => plateNumber && save({ plateNumber })}
					/>
					<InlineField
						label="Color"
						value={vehicle.color}
						saving={isSaving("color")}
						onSave={(color) => save({ color })}
					/>
					<InlineSelectField
						label="Status"
						value={vehicle.status}
						options={VEHICLE_STATUS_OPTIONS}
						onSave={(status) => save({ status: status as never })}
					/>
					<InlineField
						label="Daily rate"
						value={
							vehicle.dailyRateCents === null
								? null
								: String(vehicle.dailyRateCents / 100)
						}
						saving={isSaving("dailyRateCents")}
						onSave={(next) => {
							if (next === "") return save({ dailyRateCents: null });
							const parsed = Number.parseFloat(next);
							if (!Number.isFinite(parsed) || parsed < 0) {
								toast.error("Daily rate has to be a number.");
								return;
							}
							save({ dailyRateCents: Math.round(parsed * 100) });
						}}
						render={(value) =>
							formatMoney(Math.round(Number(value) * 100), vehicle.currency)
						}
					/>
					<InlineField
						label="Mileage"
						value={String(vehicle.mileage)}
						saving={isSaving("mileage")}
						onSave={(next) => save({ mileage: Number(next) || 0 })}
					/>
					<InlineField
						label="Insurance policy #"
						value={vehicle.insurancePolicyNumber}
						saving={isSaving("insurancePolicyNumber")}
						onSave={(insurancePolicyNumber) => save({ insurancePolicyNumber })}
					/>
					<InlineDateField
						label="Insurance expires"
						value={vehicle.insuranceExpiresAt}
						saving={isSaving("insuranceExpiresAt")}
						onSave={(next) => save({ insuranceExpiresAt: next || null })}
					/>
					<InlineDateField
						label="Registration expires"
						value={vehicle.registrationExpiresAt}
						saving={isSaving("registrationExpiresAt")}
						onSave={(next) => save({ registrationExpiresAt: next || null })}
					/>
					<InlineDateField
						label="Next maintenance"
						value={vehicle.nextMaintenanceAtDate}
						saving={isSaving("nextMaintenanceAtDate")}
						onSave={(next) => save({ nextMaintenanceAtDate: next || null })}
					/>
					<InlineSelectField
						label="Owner"
						value={vehicle.owner.id}
						options={(users.data ?? []).map((user) => ({
							value: user.id,
							label: user.name,
						}))}
						onSave={(ownerId) => save({ ownerId })}
					/>
					<RecordFields
						fields={vehicle.fields}
						saving={isSavingField}
						onSave={saveFields}
					/>
				</DetailSheetProperties>
			</DetailSheetSection>
		</DetailSheetBody>
	);
}

function VehicleRentalHistory({ vehicleId }: { vehicleId: string }) {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();

	const contracts = useQuery(
		trpc.rentalContracts.list.queryOptions({
			q: "",
			sort: "startDate",
			dir: "desc",
			page: 1,
			pageSize: 50,
			owner: "all",
			status: "all",
			vehicle: vehicleId,
			channel: "all",
		}),
	);

	const rows = contracts.data?.rows ?? [];

	if (!contracts.isPending && rows.length === 0) {
		return (
			<DetailSheetEmpty
				icon={Calendar}
				title="No rental history"
				description="This vehicle has not been rented out yet."
			/>
		);
	}

	return (
		<SimpleTable variant="panel" columns={CONTRACT_COLUMNS}>
			{rows.map((contract) => (
				<SimpleTableRow
					key={contract.id}
					clickable
					onClick={() =>
						openRecord({ kind: "rentalContract", id: contract.id })
					}
				>
					<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
						{contract.contact.firstName} {contract.contact.lastName ?? ""}
					</TableCell>
					<TableCell className="px-3 py-2.5">
						<RentalStatusIndicator status={contract.status} />
					</TableCell>
					<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
						<LocalDay date={contract.startDate} /> –{" "}
						<LocalDay date={contract.endDate} />
					</TableCell>
					<TableCell className="px-3 py-2.5 text-right tabular-nums">
						{contract.totalAmountCents === null ? (
							<EmptyCellValue />
						) : (
							formatMoney(contract.totalAmountCents, contract.currency)
						)}
					</TableCell>
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}

function VehicleMaintenance({ vehicleId }: { vehicleId: string }) {
	const trpc = useTRPC();
	const [adding, setAdding] = useState(false);

	const records = useQuery(
		trpc.maintenanceRecords.listByVehicle.queryOptions({ vehicleId }),
	);

	const rows = records.data ?? [];

	const form = adding ? (
		<MaintenanceForm vehicleId={vehicleId} onDone={() => setAdding(false)} />
	) : null;

	if (!records.isPending && rows.length === 0) {
		return (
			<>
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={ToolKit}
						title="No maintenance recorded"
						description="Nothing has been serviced on this vehicle yet."
						action={
							<button
								type="button"
								onClick={() => setAdding(true)}
								className="text-foreground text-sm underline-offset-2 hover:underline"
							>
								Add a maintenance record
							</button>
						}
					/>
				)}
			</>
		);
	}

	return (
		<>
			{form}
			<SimpleTable variant="panel" columns={MAINTENANCE_COLUMNS}>
				{rows.map((record) => (
					<SimpleTableRow key={record.id}>
						<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
							{record.description}
						</TableCell>
						<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
							{record.completedAt ? (
								<LocalDay date={record.completedAt} />
							) : record.scheduledAtDate ? (
								<LocalDay date={record.scheduledAtDate} />
							) : (
								<EmptyCellValue />
							)}
						</TableCell>
						<TableCell className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
							{record.odometerAtService ?? <EmptyCellValue />}
						</TableCell>
						<TableCell className="px-3 py-2.5 text-right tabular-nums">
							{record.costCents === null ? (
								<EmptyCellValue />
							) : (
								formatMoney(record.costCents, record.currency ?? "USD")
							)}
						</TableCell>
					</SimpleTableRow>
				))}
			</SimpleTable>
			{adding ? null : (
				<button
					type="button"
					onClick={() => setAdding(true)}
					className="w-full border-t px-5 py-2 text-left text-muted-foreground text-sm hover:text-foreground"
				>
					Add a maintenance record
				</button>
			)}
		</>
	);
}

function MaintenanceForm({
	vehicleId,
	onDone,
}: {
	vehicleId: string;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [description, setDescription] = useState("");
	const [scheduledAtDate, setScheduledAtDate] = useState("");
	const descriptionId = useId();

	const create = useMutation(
		trpc.maintenanceRecords.create.mutationOptions({
			onSuccess: async () => {
				await cache.vehicle(vehicleId);
				toast.success("Maintenance record added.");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<QuickAddForm
			submitLabel="Add record"
			pending={create.isPending}
			ready={description.trim() !== ""}
			onCancel={onDone}
			onSubmit={() =>
				create.mutate({
					vehicleId,
					type: "SCHEDULED",
					description,
					scheduledAtDate: scheduledAtDate || null,
				})
			}
		>
			<Field className="sm:col-span-2">
				<FieldLabel htmlFor={descriptionId}>Work</FieldLabel>
				<Input
					id={descriptionId}
					autoFocus
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					placeholder="Oil and filter change"
					autoComplete="off"
				/>
			</Field>
			<Field>
				<FieldLabel>Scheduled for</FieldLabel>
				<Input
					type="date"
					value={scheduledAtDate}
					onChange={(event) => setScheduledAtDate(event.target.value)}
				/>
			</Field>
		</QuickAddForm>
	);
}

function VehicleIncidents({ vehicleId }: { vehicleId: string }) {
	const trpc = useTRPC();
	const [adding, setAdding] = useState(false);

	const incidents = useQuery(
		trpc.incidents.listByVehicle.queryOptions({ vehicleId }),
	);

	const rows = incidents.data ?? [];

	const form = adding ? (
		<IncidentForm vehicleId={vehicleId} onDone={() => setAdding(false)} />
	) : null;

	if (!incidents.isPending && rows.length === 0) {
		return (
			<>
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={Warning}
						title="No incidents"
						description="Nothing has been reported on this vehicle."
						action={
							<button
								type="button"
								onClick={() => setAdding(true)}
								className="text-foreground text-sm underline-offset-2 hover:underline"
							>
								Report an incident
							</button>
						}
					/>
				)}
			</>
		);
	}

	return (
		<>
			{form}
			<SimpleTable variant="panel" columns={INCIDENT_COLUMNS}>
				{rows.map((incident) => (
					<SimpleTableRow key={incident.id}>
						<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
							{incident.type}
						</TableCell>
						<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
							{incident.description}
						</TableCell>
						<TableCell className="px-3 py-2.5 text-muted-foreground">
							{incident.responsibleParty}
						</TableCell>
						<TableCell className="px-3 py-2.5 text-muted-foreground">
							{incident.insuranceStatus}
						</TableCell>
					</SimpleTableRow>
				))}
			</SimpleTable>
			{adding ? null : (
				<button
					type="button"
					onClick={() => setAdding(true)}
					className="w-full border-t px-5 py-2 text-left text-muted-foreground text-sm hover:text-foreground"
				>
					Report an incident
				</button>
			)}
		</>
	);
}

function IncidentForm({
	vehicleId,
	onDone,
}: {
	vehicleId: string;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [description, setDescription] = useState("");
	const descriptionId = useId();

	const create = useMutation(
		trpc.incidents.create.mutationOptions({
			onSuccess: async () => {
				await cache.vehicle(vehicleId);
				toast.success("Incident reported.");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<QuickAddForm
			submitLabel="Report incident"
			pending={create.isPending}
			ready={description.trim() !== ""}
			onCancel={onDone}
			onSubmit={() => create.mutate({ vehicleId, type: "DAMAGE", description })}
		>
			<Field className="sm:col-span-2">
				<FieldLabel htmlFor={descriptionId}>What happened</FieldLabel>
				<Textarea
					id={descriptionId}
					autoFocus
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					placeholder="Scratch on the rear bumper noticed at check-in."
					rows={3}
				/>
			</Field>
		</QuickAddForm>
	);
}
