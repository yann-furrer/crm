"use client";

import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { formatMoney } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { contactName } from "@/components/crm/contact-name";
import { useFieldColumns } from "@/components/crm/fields/field-columns";
import { OwnerCell } from "@/components/crm/owner-cell";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { RentalStatusIndicator } from "@/components/crm/rental-status";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalDay, LocalRelativeTime } from "@/components/local-date-time";
import { RENTAL_STATUS_OPTIONS } from "@/lib/rental-status";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { RentalContractsBulkActions } from "./rental-contracts-bulk-actions";
import { rentalContractsSearchParams } from "./rental-contracts-search-params";

type ContractRow = RouterOutputs["rentalContracts"]["list"]["rows"][number];

const CHANNEL_LABEL: Record<string, string> = {
	AGENT: "Agent",
	ONLINE: "Online",
};

const COLUMNS: DataTableColumn<ContractRow>[] = [
	{
		id: "vehicle",
		header: "Vehicle",
		sortable: true,
		hideable: false,
		width: "w-[18%]",
		cell: (row) => (
			<span className="truncate">
				<span className="font-medium">
					{row.vehicle.make} {row.vehicle.model}
				</span>
				<span className="text-muted-foreground">
					{" "}
					· {row.vehicle.plateNumber}
				</span>
			</span>
		),
	},
	{
		id: "contact",
		header: "Renter",
		sortable: true,
		width: "w-[16%]",
		cell: (row) => <span className="truncate">{contactName(row.contact)}</span>,
	},
	{
		id: "status",
		header: "Status",
		sortable: true,
		width: "w-[14%]",
		cell: (row) => (
			<span className="flex items-center gap-2">
				<RentalStatusIndicator status={row.status} />
				{row.isLate ? (
					<span className="text-destructive text-xs">Overdue</span>
				) : null}
			</span>
		),
	},
	{
		id: "startDate",
		header: "Dates",
		sortable: true,
		width: "w-[18%]",
		hideBelow: "sm",
		cell: (row) => (
			<span className="text-muted-foreground">
				<LocalDay date={row.startDate} /> – <LocalDay date={row.endDate} />
			</span>
		),
	},
	{
		id: "amount",
		header: "Amount",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "sm",
		cell: (row) =>
			row.totalAmountCents === null ? (
				<EmptyCellValue />
			) : (
				<span className="tabular-nums">
					{formatMoney(row.totalAmountCents, row.currency)}
				</span>
			),
	},
	{
		id: "owner",
		header: "Owner",
		sortable: true,
		width: "w-[12%]",
		hideBelow: "md",
		cell: (row) => <OwnerCell owner={row.owner} />,
	},
	{
		id: "lastActivity",
		header: "Last activity",
		sortable: true,
		align: "right",
		width: "w-[10%]",
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

export function RentalContractsTable() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const { query, input } = useTableQuery(rentalContractsSearchParams);

	const contracts = useQuery({
		...trpc.rentalContracts.list.queryOptions(input),
		placeholderData: (previous) => previous,
	});
	const users = useQuery(trpc.users.list.queryOptions());

	const rows = contracts.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = contracts.data?.facetCounts;

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
			options: RENTAL_STATUS_OPTIONS.filter(
				(option) => (facetCounts?.status?.[option.value] ?? 0) > 0,
			),
		},
		{
			id: "channel",
			label: "Channel",
			options: Object.entries(CHANNEL_LABEL).flatMap(([value, label]) =>
				(facetCounts?.channel?.[value] ?? 0) > 0 ? [{ value, label }] : [],
			),
		},
	];

	const unconverted = contracts.data?.unconverted;

	const fieldColumns = useFieldColumns<ContractRow>("RENTAL_CONTRACT");
	const columns = useMemo(() => [...COLUMNS, ...fieldColumns], [fieldColumns]);

	return (
		<DataTable
			query={query}
			search={<ListSearch placeholder="Search by vehicle or renter…" />}
			columns={columns}
			rows={rows}
			total={contracts.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			selection={{
				state: selection,
				actions: (
					<RentalContractsBulkActions
						ids={selection.ids}
						onDone={selection.clear}
					/>
				),
				rowLabel: (row) => `${row.vehicle.make} ${row.vehicle.model}`,
			}}
			getRowId={(row) => row.id}
			loading={contracts.isFetching}
			onRowHover={(row) =>
				prefetchRecord({ kind: "rentalContract", id: row.id })
			}
			onRowClick={(row) => openRecord({ kind: "rentalContract", id: row.id })}
			empty="No rental contracts match this view."
			meta={
				unconverted && unconverted.count > 0 ? (
					<span className="text-muted-foreground">
						{contracts.data?.total ?? 0} contracts · {unconverted.count} not
						counted (no {unconverted.currencies.join(", ")} rate)
					</span>
				) : (
					<span>{contracts.data?.total ?? 0} contracts</span>
				)
			}
		/>
	);
}
