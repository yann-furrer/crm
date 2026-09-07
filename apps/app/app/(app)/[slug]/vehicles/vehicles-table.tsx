"use client";

import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { formatMoney } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useFieldColumns } from "@/components/crm/fields/field-columns";
import { OwnerCell } from "@/components/crm/owner-cell";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { VehiclesBulkActions } from "./vehicles-bulk-actions";
import { vehiclesSearchParams } from "./vehicles-search-params";

type VehicleRow = RouterOutputs["vehicles"]["list"]["rows"][number];

const TYPE_LABEL: Record<string, string> = {
	CAR: "Car",
	MOTORCYCLE: "Motorcycle",
	SCOOTER: "Scooter",
	TRUCK: "Truck",
	MINIBUS: "Minibus",
};

const STATUS_TONE: Record<
	string,
	"neutral" | "info" | "warning" | "success" | "error"
> = {
	AVAILABLE: "success",
	RESERVED: "info",
	RENTED: "info",
	MAINTENANCE: "warning",
	OUT_OF_SERVICE: "warning",
	STOLEN: "error",
};

const STATUS_LABEL: Record<string, string> = {
	AVAILABLE: "Available",
	RESERVED: "Reserved",
	RENTED: "Rented",
	MAINTENANCE: "Maintenance",
	OUT_OF_SERVICE: "Out of service",
	STOLEN: "Stolen",
};

const COLUMNS: DataTableColumn<VehicleRow>[] = [
	{
		id: "make",
		header: "Vehicle",
		sortable: true,
		hideable: false,
		width: "w-[24%]",
		cell: (row) => (
			<span className="truncate">
				<span className="font-medium">
					{row.make} {row.model}
				</span>
				<span className="text-muted-foreground"> · {row.plateNumber}</span>
			</span>
		),
	},
	{
		id: "type",
		header: "Type",
		sortable: true,
		width: "w-[12%]",
		cell: (row) => TYPE_LABEL[row.type] ?? row.type,
	},
	{
		id: "status",
		header: "Status",
		sortable: true,
		width: "w-[14%]",
		cell: (row) => (
			<StatusIndicator
				tone={STATUS_TONE[row.status] ?? "neutral"}
				label={STATUS_LABEL[row.status] ?? row.status}
			/>
		),
	},
	{
		id: "dailyRate",
		header: "Daily rate",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "sm",
		cell: (row) =>
			row.dailyRateCents === null ? (
				<EmptyCellValue />
			) : (
				<span className="tabular-nums">
					{formatMoney(row.dailyRateCents, row.currency)}
				</span>
			),
	},
	{
		id: "mileage",
		header: "Mileage",
		sortable: true,
		align: "right",
		width: "w-[10%]",
		hideBelow: "md",
		cell: (row) => (
			<span className="tabular-nums text-muted-foreground">
				{row.mileage.toLocaleString()} km
			</span>
		),
	},
	{
		id: "owner",
		header: "Owner",
		sortable: true,
		width: "w-[14%]",
		hideBelow: "md",
		cell: (row) => <OwnerCell owner={row.owner} />,
	},
	{
		id: "lastActivity",
		header: "Last activity",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "lg",
		cell: (row) => (
			<span className="text-muted-foreground">
				{row.lastActivityAt ? (
					<LocalRelativeTime date={row.lastActivityAt} />
				) : (
					<EmptyCellValue />
				)}
			</span>
		),
	},
];

export function VehiclesTable() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const { query, input } = useTableQuery(vehiclesSearchParams);

	const vehicles = useQuery({
		...trpc.vehicles.list.queryOptions(input),
		placeholderData: (previous) => previous,
	});
	const users = useQuery(trpc.users.list.queryOptions());

	const rows = vehicles.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = vehicles.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "owner",
			label: "Owner",
			options: (users.data ?? []).flatMap((user) =>
				(facetCounts?.owner?.[user.id] ?? 0) > 0
					? [{ value: user.id, label: user.name }]
					: [],
			),
		},
		{
			id: "status",
			label: "Status",
			options: Object.entries(STATUS_LABEL).flatMap(([value, label]) =>
				(facetCounts?.status?.[value] ?? 0) > 0 ? [{ value, label }] : [],
			),
		},
		{
			id: "type",
			label: "Type",
			options: Object.entries(TYPE_LABEL).flatMap(([value, label]) =>
				(facetCounts?.type?.[value] ?? 0) > 0 ? [{ value, label }] : [],
			),
		},
	];

	const unconverted = vehicles.data?.unconverted;

	const fieldColumns = useFieldColumns<VehicleRow>("VEHICLE");
	const columns = useMemo(() => [...COLUMNS, ...fieldColumns], [fieldColumns]);

	return (
		<DataTable
			query={query}
			search={
				<ListSearch placeholder="Search vehicles by plate, make or model…" />
			}
			columns={columns}
			rows={rows}
			total={vehicles.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			selection={{
				state: selection,
				actions: (
					<VehiclesBulkActions ids={selection.ids} onDone={selection.clear} />
				),
				rowLabel: (row) => `${row.make} ${row.model}`,
			}}
			getRowId={(row) => row.id}
			loading={vehicles.isFetching}
			onRowHover={(row) => prefetchRecord({ kind: "vehicle", id: row.id })}
			onRowClick={(row) => openRecord({ kind: "vehicle", id: row.id })}
			empty="No vehicles match this view."
			meta={
				unconverted && unconverted.count > 0 ? (
					<span className="text-muted-foreground">
						{vehicles.data?.total ?? 0} vehicles · {unconverted.count} not
						counted (no {unconverted.currencies.join(", ")} rate)
					</span>
				) : (
					<span>{vehicles.data?.total ?? 0} vehicles</span>
				)
			}
		/>
	);
}
