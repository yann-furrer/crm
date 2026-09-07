"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardPanel,
	CardPanelEmpty,
	CardTitle,
} from "@crm/ui/components/card";
import { CardTableEmpty } from "@crm/ui/components/card-table";
import { Checkbox } from "@crm/ui/components/checkbox";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { formatCount, formatMoneyCompact } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useQueryState } from "nuqs";
import type { CSSProperties } from "react";
import { toast } from "sonner";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { RentalStatusIndicator } from "@/components/crm/rental-status";
import { LocalRelativeTime } from "@/components/local-date-time";
import { activityLabel } from "@/lib/activity-presentation";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { FleetDashboard } from "./fleet-dashboard";
import { overviewParsers } from "./overview-search-params";

const CELL = "px-3 py-2.5 align-middle";

const STATUS_COLOR: Record<string, string> = {
	DRAFT: "var(--chart-5)",
	RESERVED: "var(--chart-1)",
	ACTIVE: "var(--chart-2)",
};

const CONTRACT_COLUMNS: SimpleTableColumn[] = [
	{ id: "contract", header: "Contract" },
	{
		id: "status",
		header: "Status",
		width: "w-32",
		className: "hidden lg:table-cell",
	},
	{
		id: "share",
		srLabel: "Share of the largest",
		width: "w-24",
		className: "hidden sm:table-cell",
	},
	{ id: "value", header: "Value", width: "w-20", align: "right" },
];
const TASK_COLUMNS: SimpleTableColumn[] = [
	{ id: "done", srLabel: "Done", width: "w-8" },
	{ id: "task", header: "Task" },
	{ id: "overdue", header: "Overdue", width: "w-24", align: "right" },
];
const ACTIVITY_COLUMNS: SimpleTableColumn[] = [
	{ id: "activity", header: "Activity" },
	{
		id: "company",
		header: "Company",
		width: "w-44",
		className: "hidden md:table-cell",
	},
	{
		id: "contract",
		header: "Contract",
		width: "w-48",
		className: "hidden lg:table-cell",
	},
	{
		id: "who",
		header: "Who",
		width: "w-32",
		className: "hidden md:table-cell",
	},
	{ id: "when", header: "When", width: "w-20", align: "right" },
];

export function DashboardSummary() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const openRecord = useOpenRecord();
	const workspaceUrl = useWorkspaceUrl();

	const [scope] = useQueryState("scope", overviewParsers.scope);

	const summaryQuery = useQuery({
		...trpc.dashboard.summary.queryOptions({ scope }),
		placeholderData: (previous) => previous,
	});

	const complete = useMutation(
		trpc.activities.complete.mutationOptions({
			onSuccess: () => cache.activity(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const summary = summaryQuery.data;

	if (!summary) {
		return (
			<div className="flex flex-1 justify-center py-12">
				<Spinner />
			</div>
		);
	}

	const { topActiveContracts, overdueTasks, recentActivity } = summary;

	const mine = scope === "me";
	const largestActiveCents = topActiveContracts[0]?.baseAmountCents ?? 0;

	return (
		<div className="flex flex-col gap-6">
			<FleetDashboard summary={summary} />

			<div className="grid gap-6 @3xl/page-content:grid-cols-2">
				<Card className="min-w-0">
					<CardHeader>
						<CardTitle>Active contracts</CardTitle>
						<CardDescription>
							The highest-value reservations and rentals in progress
						</CardDescription>
						<CardAction>
							<Button asChild variant="contrast" size="sm">
								<Link href={workspaceUrl("/rental-contracts")}>
									Open contracts
								</Link>
							</Button>
						</CardAction>
					</CardHeader>
					<CardPanel>
						{topActiveContracts.length === 0 ? (
							<CardPanelEmpty>
								Nothing active. Time to fill the fleet.
							</CardPanelEmpty>
						) : (
							<SimpleTable
								variant="panel"
								surface="page"
								columns={CONTRACT_COLUMNS}
							>
								{topActiveContracts.map((contract) => (
									<SimpleTableRow
										key={contract.id}
										clickable
										onClick={() =>
											openRecord({ kind: "rentalContract", id: contract.id })
										}
									>
										<TableCell className={CELL}>
											<ContractCell
												vehicle={contract.vehicle}
												renterName={`${contract.contact.firstName} ${contract.contact.lastName ?? ""}`.trim()}
											/>
										</TableCell>
										<TableCell className={`${CELL} hidden lg:table-cell`}>
											<RentalStatusIndicator status={contract.status} />
										</TableCell>
										<TableCell className={`${CELL} hidden sm:table-cell`}>
											<ValueMeter
												share={
													largestActiveCents > 0
														? ((contract.baseAmountCents ?? 0) /
																largestActiveCents) *
															100
														: 0
												}
												color={
													STATUS_COLOR[contract.status] ?? "var(--chart-5)"
												}
											/>
										</TableCell>
										<TableCell className={`${CELL} text-right tabular-nums`}>
											{contract.totalAmountCents === null ? (
												<EmptyCellValue />
											) : (
												formatMoneyCompact(
													contract.totalAmountCents,
													contract.currency,
												)
											)}
										</TableCell>
									</SimpleTableRow>
								))}
							</SimpleTable>
						)}
					</CardPanel>
				</Card>

				<Card className="min-w-0">
					<CardHeader>
						<CardTitle>Overdue tasks</CardTitle>
						<CardDescription>
							{overdueTasks.length === 0
								? "Every task you have logged is either done or still to come"
								: `${formatCount(overdueTasks.length, "task")} past due`}
						</CardDescription>
					</CardHeader>
					<CardPanel>
						{overdueTasks.length === 0 ? (
							<CardPanelEmpty>Nothing overdue. Good.</CardPanelEmpty>
						) : (
							<SimpleTable
								variant="panel"
								surface="page"
								columns={TASK_COLUMNS}
							>
								{overdueTasks.map((task) => (
									<SimpleTableRow key={task.id}>
										<TableCell className={CELL}>
											<Checkbox
												checked={false}
												disabled={complete.isPending}
												aria-label="Mark as done"
												onCheckedChange={() =>
													complete.mutate({ id: task.id, completed: true })
												}
											/>
										</TableCell>
										<TableCell className={CELL}>
											<span className="flex min-w-0 flex-col">
												<span className="truncate">{task.subject}</span>
												<span className="flex min-w-0 text-muted-foreground">
													{task.rentalContract ? (
														<RecordLink
															kind="rentalContract"
															id={task.rentalContract.id}
														>
															{task.rentalContract.vehicle.plateNumber}
														</RecordLink>
													) : task.company ? (
														<RecordLink kind="company" id={task.company.id}>
															{task.company.name}
														</RecordLink>
													) : null}
												</span>
											</span>
										</TableCell>
										<TableCell className={`${CELL} text-right`}>
											<StatusIndicator
												tone="error"
												label={
													task.dueAt ? (
														<LocalRelativeTime date={task.dueAt} />
													) : (
														"No due date"
													)
												}
											/>
										</TableCell>
									</SimpleTableRow>
								))}
							</SimpleTable>
						)}
					</CardPanel>
				</Card>
			</div>

			<Card className="min-w-0">
				<CardHeader>
					<CardTitle>
						{mine ? "Your recent activity" : "Recent activity"}
					</CardTitle>
					<CardDescription>
						{mine
							? "Every note, task and status change you have logged"
							: "Every note, task and status change across the workspace"}
					</CardDescription>
					<CardAction>
						<Button asChild variant="contrast" size="sm">
							<Link href={workspaceUrl("/companies")}>All companies</Link>
						</Button>
					</CardAction>
				</CardHeader>
				{recentActivity.length === 0 ? (
					<CardTableEmpty>Nothing has happened yet.</CardTableEmpty>
				) : (
					<SimpleTable columns={ACTIVITY_COLUMNS}>
						{recentActivity.map((entry) => (
							<SimpleTableRow key={entry.id}>
								<TableCell className={CELL}>
									<span className="truncate">
										{entry.subject ?? activityLabel(entry.type)}
									</span>
								</TableCell>
								<TableCell className={`${CELL} hidden md:table-cell`}>
									{entry.company ? (
										<RecordLink kind="company" id={entry.company.id}>
											{entry.company.name}
										</RecordLink>
									) : (
										<EmptyCellValue />
									)}
								</TableCell>
								<TableCell className={`${CELL} hidden lg:table-cell`}>
									{entry.rentalContract ? (
										<RecordLink
											kind="rentalContract"
											id={entry.rentalContract.id}
										>
											{entry.rentalContract.vehicle.plateNumber}
										</RecordLink>
									) : (
										<EmptyCellValue />
									)}
								</TableCell>
								<TableCell
									className={`${CELL} hidden truncate text-muted-foreground md:table-cell`}
								>
									{entry.createdBy.name}
								</TableCell>
								<TableCell
									className={`${CELL} text-right text-muted-foreground`}
								>
									<LocalRelativeTime date={entry.createdAt} />
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				)}
			</Card>
		</div>
	);
}

function ContractCell({
	vehicle,
	renterName,
}: {
	vehicle: { make: string; model: string; plateNumber: string };
	renterName: string;
}) {
	return (
		<span className="flex min-w-0 flex-col">
			<span className="truncate font-medium">
				{vehicle.make} {vehicle.model}
			</span>
			<span className="truncate text-muted-foreground">
				{vehicle.plateNumber} · {renterName}
			</span>
		</span>
	);
}

function ValueMeter({ share, color }: { share: number; color: string }) {
	return (
		<span
			className="bloom-low flex h-1.5 w-full overflow-hidden bg-muted"
			style={{ "--bloom-color": color } as CSSProperties}
		>
			<span
				className="h-full w-(--share)"
				style={
					{
						backgroundColor: color,
						"--share": `${Math.round(Math.max(Math.min(share, 100), 0))}%`,
					} as CSSProperties
				}
			/>
		</span>
	);
}
