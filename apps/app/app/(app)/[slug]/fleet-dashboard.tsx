"use client";

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import type { ChartConfig } from "@crm/ui/components/chart";
import { DashboardRow, StatGroup } from "@crm/ui/components/dashboard";
import { StatCard, type StatDelta } from "@crm/ui/components/stat-card";
import {
	formatCount,
	formatMoney,
	formatMoneyCompact,
	formatPercent,
} from "@crm/ui/lib/format";
import Link from "next/link";
import type { ReactNode } from "react";
import { AreaTrend, DonutStat } from "@/components/dashboard-charts";
import { rentalStatusLabel } from "@/lib/rental-status";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Summary = RouterOutputs["dashboard"]["summary"];

const TREND_CONFIG: ChartConfig = {
	completed: { label: "Completed", color: "var(--success)" },
	created: { label: "New bookings", color: "var(--chart-1)" },
};

const STATUS_COLOR: Record<string, string> = {
	DRAFT: "var(--chart-5)",
	RESERVED: "var(--chart-1)",
	ACTIVE: "var(--chart-2)",
};

function changeDelta(
	current: number,
	previous: number,
	label: string,
): StatDelta | undefined {
	if (previous === 0) return undefined;
	const change = Math.round(((current - previous) / previous) * 100);
	return {
		value: `${change >= 0 ? "+" : ""}${change}%`,
		direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
		label,
	};
}

export function FleetDashboard({ summary }: { summary: Summary }) {
	const workspaceUrl = useWorkspaceUrl();

	const {
		fleet,
		completedThisMonth,
		completedPrevMonth,
		performance,
		trend,
		dueBackThisMonth,
		reportingCurrency,
		unconverted,
	} = summary;

	const money = (cents: number) => formatMoneyCompact(cents, reportingCurrency);
	const exact = (value: unknown) =>
		formatMoney(
			typeof value === "number" ? value : Number(value),
			reportingCurrency,
		);

	const hasTrend = trend.some(
		(point) => point.completed > 0 || point.created > 0,
	);

	const statusSlices = fleet.statuses.flatMap((status) =>
		status.valueCents > 0
			? [
					{
						key: status.status,
						label: rentalStatusLabel(status.status),
						value: status.valueCents,
						color: STATUS_COLOR[status.status] ?? "var(--chart-5)",
						count: status.count,
					},
				]
			: [],
	);

	return (
		<div className="flex flex-col gap-6">
			<StatGroup>
				<StatCard
					label="Completed this month"
					value={money(completedThisMonth.valueCents)}
					delta={changeDelta(
						completedThisMonth.valueCents,
						completedPrevMonth.valueCents,
						"vs. last month",
					)}
					description={`${formatCount(completedThisMonth.count, "contract")} · ${money(completedPrevMonth.valueCents)} last month`}
				/>
				<StatCard
					label="Active fleet value"
					value={money(fleet.totalCents)}
					description={`${formatCount(fleet.totalContracts, "contract")} in progress · ${money(dueBackThisMonth.valueCents)} due back this month`}
				/>
				<StatCard
					label={`Completion rate (${performance.windowDays}d)`}
					value={
						performance.completionRate === null
							? "—"
							: formatPercent(performance.completionRate)
					}
					description={
						performance.completedCount + performance.cancelledCount === 0
							? "Nothing has wrapped up yet"
							: `${performance.completedCount} completed · ${performance.cancelledCount} cancelled`
					}
				/>
				<StatCard
					label={`Average contract (${performance.windowDays}d)`}
					value={
						performance.avgContractCents === null
							? "—"
							: money(performance.avgContractCents)
					}
					description={
						performance.avgDurationDays === null
							? "No completions to measure"
							: `${performance.avgDurationDays}-day average duration`
					}
				/>
			</StatGroup>

			{unconverted.count > 0 ? (
				<p className="text-muted-foreground text-xs">
					Every figure above is in {reportingCurrency}.{" "}
					{formatCount(unconverted.count, "record")} in{" "}
					{unconverted.currencies.join(", ")}{" "}
					{unconverted.count === 1 ? "is" : "are"} not included — there is no
					rate to convert {unconverted.currencies.length === 1 ? "it" : "them"}{" "}
					with.{" "}
					<Link
						href={workspaceUrl("/settings/currencies")}
						className="underline hover:no-underline"
					>
						Set one
					</Link>
					.
				</p>
			) : null}

			<DashboardRow split="hero">
				<ChartPanel
					title="Completed vs. new bookings"
					description="Last six months, by the month a contract was returned or created"
				>
					{hasTrend ? (
						<div className="flex flex-1 flex-col justify-center py-4">
							<AreaTrend
								data={trend}
								config={TREND_CONFIG}
								xKey="month"
								height={196}
								variant="gradient"
								bloom="high"
								showLegend
								formatValue={exact}
							/>
						</div>
					) : (
						<EmptyChart label="No contracts completed or created yet" />
					)}
				</ChartPanel>

				<ChartPanel
					title="Fleet value by status"
					description="Where the value sits right now"
				>
					{statusSlices.length > 0 ? (
						<div className="flex flex-1 flex-col justify-between gap-1 pt-4">
							<DonutStat
								data={statusSlices}
								height={168}
								centerValue={money(fleet.totalCents)}
								centerLabel="active"
								formatValue={exact}
							/>
							<ul className="flex flex-col px-5 pb-1 md:px-6">
								{statusSlices.map((slice) => (
									<li key={slice.key} className="border-t first:border-t-0">
										<Link
											href={`${workspaceUrl("/rental-contracts")}?status=${slice.key}`}
											className="flex items-center gap-2.5 py-2 text-xs hover:underline"
										>
											<span
												aria-hidden
												className="size-1.5 shrink-0"
												style={{ backgroundColor: slice.color }}
											/>
											<span className="min-w-0 flex-1 truncate">
												{slice.label}
											</span>
											<span className="shrink-0 text-muted-foreground tabular-nums">
												{slice.count}
											</span>
											<span className="w-14 shrink-0 text-right font-medium tabular-nums">
												{money(slice.value)}
											</span>
										</Link>
									</li>
								))}
							</ul>
						</div>
					) : (
						<EmptyChart label="Nothing active" />
					)}
				</ChartPanel>
			</DashboardRow>
		</div>
	);
}

function ChartPanel({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
			</CardHeader>
			<div className="flex flex-1 flex-col border">{children}</div>
		</Card>
	);
}

function EmptyChart({ label }: { label: string }) {
	return (
		<div className="flex flex-1 items-center justify-center px-5 py-10 text-muted-foreground text-sm md:px-6">
			{label}
		</div>
	);
}
