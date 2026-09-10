"use client";

import Add from "@carbon/icons-react/es/Add";
import Close from "@carbon/icons-react/es/Close";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import Wallet from "@carbon/icons-react/es/Wallet";
import Warning from "@carbon/icons-react/es/Warning";
import { CURRENCIES, normalizeCurrency } from "@crm/db/currency";
import type { FieldValueJson } from "@crm/db/fields";
import { Button } from "@crm/ui/components/button";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { EntityLogo } from "@crm/ui/components/entity-logo";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { Textarea } from "@crm/ui/components/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { formatMoney } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { AgentPanel } from "@/components/crm/agent-panel";
import { contactName } from "@/components/crm/contact-name";
import { FieldsCog, RecordFields } from "@/components/crm/fields/record-fields";
import {
	InlineDateField,
	InlineField,
	InlineSelectField,
	InlineTextArea,
	savingValue,
} from "@/components/crm/inline-field";
import { OwnerCell } from "@/components/crm/owner-cell";
import { RentalStatusMenu } from "@/components/crm/status-change";
import { StatusStepper } from "@/components/crm/status-stepper";
import { Timeline } from "@/components/crm/timeline/timeline";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetProperties,
	DetailSheetProperty,
	DetailSheetSection,
	DetailSheetStat,
	DetailSheetStats,
	type DetailSheetTab,
} from "@/components/detail-sheet";
import { LocalDateTime, LocalDay } from "@/components/local-date-time";
import { savingField } from "@/lib/pending-field";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { QuickAddForm } from "./quick-add";
import { AttachDriver } from "./quick-add-rental";
import { RecordActions } from "./record-actions";
import { AddRow, MoneyAmount, RecordSheetFrame } from "./record-parts";
import { useOpenRecord, useRecordSheetView } from "./record-stack";

type RentalContract = RouterOutputs["rentalContracts"]["byId"];

const CURRENCY_OPTIONS = CURRENCIES.map((entry) => ({
	value: entry.code,
	label: `${entry.code} · ${entry.name}`,
}));

const FUEL_OPTIONS = [
	{ value: "FULL", label: "Full" },
	{ value: "THREE_QUARTER", label: "3/4" },
	{ value: "HALF", label: "Half" },
	{ value: "QUARTER", label: "1/4" },
	{ value: "EMPTY", label: "Empty" },
];

const PAYMENT_TYPE_OPTIONS = [
	{ value: "RENTAL_FEE", label: "Rental fee" },
	{ value: "DEPOSIT", label: "Deposit" },
	{ value: "DEPOSIT_REFUND", label: "Deposit refund" },
	{ value: "EXTRA_FEE", label: "Extra fee" },
	{ value: "PENALTY", label: "Penalty" },
	{ value: "MAINTENANCE_CHARGE", label: "Maintenance charge" },
];

const PAYMENT_METHOD_OPTIONS = [
	{ value: "CASH", label: "Cash" },
	{ value: "WAVE", label: "Wave" },
	{ value: "ORANGE_MONEY", label: "Orange Money" },
	{ value: "CARD", label: "Card" },
	{ value: "BANK_TRANSFER", label: "Bank transfer" },
];

const DRIVER_COLUMNS = [
	{ id: "name", header: "Name", width: "w-[36%]", className: "pl-5" },
	{ id: "role", header: "Role", width: "w-[28%]" },
	{ id: "remove", srLabel: "Remove", width: "w-10" },
];

const PAYMENT_COLUMNS = [
	{ id: "type", header: "Type", width: "w-[22%]", className: "pl-5" },
	{ id: "method", header: "Method", width: "w-[20%]" },
	{ id: "amount", header: "Amount", width: "w-[18%]", align: "right" as const },
	{ id: "when", header: "When", width: "w-[20%]" },
];

const INCIDENT_COLUMNS = [
	{ id: "type", header: "Type", width: "w-[16%]", className: "pl-5" },
	{ id: "description", header: "Description", width: "w-[40%]" },
	{ id: "insurance", header: "Insurance", width: "w-[18%]" },
];

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	year: "numeric",
};

function depositTone(status: RentalContract["depositStatus"]) {
	if (status === "RETURNED") return "success" as const;
	if (status === "PARTIALLY_RETURNED") return "warning" as const;
	if (status === "FORFEITED") return "error" as const;
	return "neutral" as const;
}

export function RentalContractSheet({ contractId }: { contractId: string }) {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const {
		tab,
		setTab,
		form: adding,
		setForm: setAdding,
	} = useRecordSheetView("overview");

	const query = useQuery(
		trpc.rentalContracts.byId.queryOptions({ id: contractId }),
	);
	const contract = query.data;

	const tabs: DetailSheetTab[] = contract
		? [
				{
					value: "overview",
					label: "Overview",
					content: <ContractOverview contract={contract} />,
				},
				{
					value: "drivers",
					label: "Drivers",
					count: contract.drivers.length,
					content: (
						<ContractDrivers
							contract={contract}
							adding={adding === "driver"}
							onAdd={() => setAdding("driver")}
							onDone={() => setAdding(null)}
						/>
					),
				},
				{
					value: "payments",
					label: "Payments",
					content: <ContractPayments contractId={contract.id} />,
				},
				{
					value: "incidents",
					label: "Incidents",
					content: (
						<ContractIncidents
							contractId={contract.id}
							vehicleId={contract.vehicle.id}
							depositCurrency={contract.depositCurrency}
						/>
					),
				},
				{
					value: "inspections",
					label: "Inspections",
					content: <ContractInspections contract={contract} />,
				},
				{
					value: "activity",
					label: "Activity",
					content: <Timeline anchor={{ rentalContractId: contract.id }} />,
				},
				{
					value: "agent",
					label: "Agent",
					content: (
						<AgentPanel record={{ kind: "rentalContract", id: contract.id }} />
					),
					keepMounted: true,
				},
			]
		: [];

	return (
		<RecordSheetFrame
			loading={query.isPending}
			error={query.error?.message ?? null}
			title={
				contract
					? `${contract.vehicle.make} ${contract.vehicle.model}`
					: "Rental contract"
			}
			description={
				contract ? (
					<button
						type="button"
						onClick={() =>
							openRecord({ kind: "contact", id: contract.contact.id })
						}
						className="text-foreground underline-offset-2 hover:underline"
					>
						{contactName(contract.contact)}
					</button>
				) : undefined
			}
			media={
				contract ? (
					<EntityLogo name={contract.vehicle.plateNumber} size="lg" />
				) : null
			}
			actions={
				contract ? (
					<>
						<RentalStatusMenu
							contractId={contract.id}
							status={contract.status}
							variant="control"
						/>
						<RecordActions
							record={{ kind: "rentalContract", id: contract.id }}
							name={`${contract.vehicle.make} ${contract.vehicle.model}`}
							consequence="Its payments, incidents, inspections and agent conversations go too. The vehicle and the renter stay in the CRM."
						/>
					</>
				) : null
			}
			stats={
				contract ? (
					<DetailSheetStats>
						<DetailSheetStat label="Total">
							<MoneyAmount
								amountCents={contract.totalAmountCents}
								currency={contract.currency}
							/>
						</DetailSheetStat>
						<DetailSheetStat label="Deposit">
							<StatusIndicator
								tone={depositTone(contract.depositStatus)}
								label={contract.depositStatus
									.replaceAll("_", " ")
									.toLowerCase()}
							/>
						</DetailSheetStat>
						<DetailSheetStat label="Dates">
							<span className="text-muted-foreground">
								<LocalDay date={contract.startDate} /> –{" "}
								<LocalDay date={contract.endDate} />
							</span>
						</DetailSheetStat>
						<DetailSheetStat label="Owner">
							<OwnerCell owner={contract.owner} />
						</DetailSheetStat>
					</DetailSheetStats>
				) : null
			}
			note={
				contract?.isLate ? (
					<StatusIndicator tone="error" label="Overdue" />
				) : null
			}
			tabs={tabs}
			tab={tab}
			onTabChange={setTab}
		/>
	);
}

function ContractOverview({ contract }: { contract: RentalContract }) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const update = useMutation(
		trpc.rentalContracts.update.mutationOptions({
			onSuccess: () => cache.rentalContract(contract.id, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const setDeposit = useMutation(
		trpc.rentalContracts.setDepositStatus.mutationOptions({
			onSuccess: () => cache.rentalContract(contract.id),
			onError: (error) => toast.error(error.message),
		}),
	);

	const saveFields = (fields: Record<string, FieldValueJson>) =>
		update.mutate({ id: contract.id, data: { fields } });

	const isSavingField = savingValue(update);
	const isSaving = savingField(update);

	const save = (data: Parameters<typeof update.mutate>[0]["data"]) =>
		update.mutate({ id: contract.id, data });

	const currency = normalizeCurrency(contract.currency) || contract.currency;

	return (
		<DetailSheetBody>
			<DetailSheetSection title="Status">
				<StatusStepper contractId={contract.id} status={contract.status} />

				{contract.cancelledReason ? (
					<DetailSheetProperties>
						<DetailSheetProperty label="Cancelled">
							{contract.cancelledAt ? (
								<LocalDateTime
									date={contract.cancelledAt}
									options={DATE_OPTIONS}
								/>
							) : (
								<EmptyCellValue />
							)}
						</DetailSheetProperty>
						<DetailSheetProperty label="Reason" wide>
							{contract.cancelledReason}
						</DetailSheetProperty>
					</DetailSheetProperties>
				) : null}
			</DetailSheetSection>

			<DetailSheetSection
				title="Details"
				action={<FieldsCog kind="rentalContract" />}
			>
				<DetailSheetProperties>
					<InlineDateField
						label="Start date"
						value={contract.startDate}
						saving={isSaving("startDate")}
						onSave={(next) => next && save({ startDate: next })}
					/>
					<InlineDateField
						label="End date"
						value={contract.endDate}
						saving={isSaving("endDate")}
						onSave={(next) => next && save({ endDate: next })}
					/>
					<InlineField
						label="Price per day"
						value={String((contract.pricePerDayCents ?? 0) / 100)}
						saving={isSaving("pricePerDayCents")}
						onSave={(next) => {
							const parsed = Number.parseFloat(next);
							if (!Number.isFinite(parsed) || parsed < 0) {
								toast.error("Price has to be a number.");
								return;
							}
							save({ pricePerDayCents: Math.round(parsed * 100) });
						}}
						render={(value) =>
							formatMoney(Math.round(Number(value) * 100), currency)
						}
					/>
					<InlineSelectField
						label="Currency"
						value={currency}
						options={CURRENCY_OPTIONS}
						onSave={(next) => save({ currency: next })}
					/>
					<InlineField
						label="Mileage included / day"
						value={
							contract.mileageIncludedPerDay === null
								? null
								: String(contract.mileageIncludedPerDay)
						}
						saving={isSaving("mileageIncludedPerDay")}
						onSave={(next) =>
							save({ mileageIncludedPerDay: next ? Number(next) : null })
						}
					/>
					<RecordFields
						fields={contract.fields}
						saving={isSavingField}
						onSave={saveFields}
					/>
				</DetailSheetProperties>
			</DetailSheetSection>

			<DetailSheetSection title="Deposit">
				<DetailSheetProperties>
					<DetailSheetProperty label="Held">
						{formatMoney(
							contract.depositAmountCents ?? 0,
							contract.depositCurrency,
						)}
					</DetailSheetProperty>
					<DetailSheetProperty label="Method">
						{contract.depositMethod}
					</DetailSheetProperty>
					<DetailSheetProperty label="Status">
						{contract.depositStatus}
					</DetailSheetProperty>
					{contract.depositReturnedAmountCents !== null ? (
						<DetailSheetProperty label="Returned">
							{formatMoney(
								contract.depositReturnedAmountCents,
								contract.depositCurrency,
							)}
						</DetailSheetProperty>
					) : null}
				</DetailSheetProperties>

				{contract.depositStatus === "HELD" ? (
					<DepositSettleForm
						depositAmountCents={contract.depositAmountCents ?? 0}
						currency={contract.depositCurrency}
						pending={setDeposit.isPending}
						onSettle={(status, amountCents) =>
							setDeposit.mutate({
								id: contract.id,
								depositStatus: status,
								depositReturnedAmountCents: amountCents,
							})
						}
					/>
				) : null}
			</DetailSheetSection>

			<DetailSheetSection title="Notes">
				<InlineTextArea
					label="Notes"
					value={contract.notes}
					placeholder="Anything worth remembering about this rental."
					saving={isSaving("notes")}
					onSave={(notes) => save({ notes })}
				/>
			</DetailSheetSection>
		</DetailSheetBody>
	);
}

function DepositSettleForm({
	depositAmountCents,
	currency,
	pending,
	onSettle,
}: {
	depositAmountCents: number;
	currency: string;
	pending: boolean;
	onSettle: (
		status: "PARTIALLY_RETURNED" | "RETURNED" | "FORFEITED",
		amountCents: number | null,
	) => void;
}) {
	const [amount, setAmount] = useState(String(depositAmountCents / 100));

	return (
		<div className="flex flex-wrap items-end gap-2 pt-3">
			<Field className="w-32">
				<FieldLabel>Returning</FieldLabel>
				<Input
					value={amount}
					onChange={(event) => setAmount(event.target.value)}
					inputMode="decimal"
				/>
			</Field>
			<Button
				variant="outline"
				size="sm"
				disabled={pending}
				onClick={() => {
					const parsed = Number.parseFloat(amount);
					if (!Number.isFinite(parsed) || parsed < 0) {
						toast.error("Enter an amount.");
						return;
					}
					const cents = Math.round(parsed * 100);
					onSettle(
						cents >= depositAmountCents ? "RETURNED" : "PARTIALLY_RETURNED",
						cents,
					);
				}}
			>
				Return {formatMoney(Math.round(Number(amount) * 100) || 0, currency)}
			</Button>
			<Button
				variant="outline"
				size="sm"
				disabled={pending}
				onClick={() => onSettle("FORFEITED", null)}
			>
				Forfeit deposit
			</Button>
		</div>
	);
}

function ContractDrivers({
	contract,
	adding,
	onAdd,
	onDone,
}: {
	contract: RentalContract;
	adding: boolean;
	onAdd: () => void;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const openRecord = useOpenRecord();

	const detach = useMutation(
		trpc.rentalContracts.detachDriver.mutationOptions({
			onSuccess: () => cache.rentalContract(contract.id, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const form = adding ? (
		<AttachDriver contractId={contract.id} onDone={onDone} />
	) : null;

	if (contract.drivers.length === 0) {
		return (
			<>
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={UserMultiple}
						title="No drivers yet"
						description="Add the renter and anyone else authorized to drive this vehicle."
						action={
							<Button variant="outline" size="sm" onClick={onAdd}>
								<Icon icon={Add} data-icon="inline-start" />
								Add driver
							</Button>
						}
					/>
				)}
			</>
		);
	}

	return (
		<>
			{form}
			<SimpleTable variant="panel" columns={DRIVER_COLUMNS}>
				{contract.drivers.map((driver) => (
					<SimpleTableRow
						key={driver.id}
						clickable
						onClick={() => openRecord({ kind: "contact", id: driver.id })}
					>
						<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
							<span className="flex min-w-0 items-center gap-2">
								<PersonAvatar
									src={driver.imageUrl}
									name={contactName(driver)}
									email={driver.email}
									size="sm"
								/>
								<span className="truncate">{contactName(driver)}</span>
							</span>
						</TableCell>
						<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
							{driver.role === "PRIMARY" ? "Renter" : "Additional driver"}
						</TableCell>
						<TableCell className="px-3 py-2.5">
							{driver.role === "PRIMARY" ? null : (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon-xs"
											disabled={detach.isPending}
											onClick={(event) => {
												event.stopPropagation();
												detach.mutate({
													contractId: contract.id,
													contactId: driver.id,
												});
											}}
										>
											<Icon icon={Close} />
											<span className="sr-only">
												Take {contactName(driver)} off this contract
											</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent>Take off this contract</TooltipContent>
								</Tooltip>
							)}
						</TableCell>
					</SimpleTableRow>
				))}

				<AddRow
					label="Add driver"
					columns={DRIVER_COLUMNS.length}
					onClick={onAdd}
				/>
			</SimpleTable>
		</>
	);
}

function ContractPayments({ contractId }: { contractId: string }) {
	const trpc = useTRPC();
	const [adding, setAdding] = useState(false);

	const payments = useQuery(
		trpc.payments.listByContract.queryOptions({ rentalContractId: contractId }),
	);

	const rows = payments.data ?? [];

	const form = adding ? (
		<PaymentForm contractId={contractId} onDone={() => setAdding(false)} />
	) : null;

	if (!payments.isPending && rows.length === 0) {
		return (
			<>
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={Wallet}
						title="No payments recorded"
						description="Nothing has been paid on this contract yet."
						action={
							<Button
								variant="outline"
								size="sm"
								onClick={() => setAdding(true)}
							>
								<Icon icon={Add} data-icon="inline-start" />
								Record payment
							</Button>
						}
					/>
				)}
			</>
		);
	}

	return (
		<>
			{form}
			<SimpleTable variant="panel" columns={PAYMENT_COLUMNS}>
				{rows.map((payment) => (
					<SimpleTableRow key={payment.id}>
						<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
							{PAYMENT_TYPE_OPTIONS.find((o) => o.value === payment.type)
								?.label ?? payment.type}
						</TableCell>
						<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
							{PAYMENT_METHOD_OPTIONS.find((o) => o.value === payment.method)
								?.label ?? payment.method}
							{payment.reference ? ` · ${payment.reference}` : ""}
						</TableCell>
						<TableCell className="px-3 py-2.5 text-right tabular-nums">
							{formatMoney(payment.amountCents ?? 0, payment.currency)}
						</TableCell>
						<TableCell className="px-3 py-2.5 text-muted-foreground">
							{payment.paidAt ? (
								<LocalDay date={payment.paidAt} />
							) : (
								<EmptyCellValue />
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
					Record payment
				</button>
			)}
		</>
	);
}

function PaymentForm({
	contractId,
	onDone,
}: {
	contractId: string;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [type, setType] = useState("RENTAL_FEE");
	const [method, setMethod] = useState("CASH");
	const [amount, setAmount] = useState("");
	const amountId = useId();

	const create = useMutation(
		trpc.payments.create.mutationOptions({
			onSuccess: async () => {
				await cache.rentalContract(contractId);
				toast.success("Payment recorded.");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<QuickAddForm
			submitLabel="Record payment"
			pending={create.isPending}
			ready={amount.trim() !== ""}
			onCancel={onDone}
			onSubmit={() => {
				const parsed = Number.parseFloat(amount);
				if (!Number.isFinite(parsed) || parsed < 0) {
					toast.error("Amount has to be a number.");
					return;
				}
				create.mutate({
					rentalContractId: contractId,
					type: type as never,
					method: method as never,
					amountCents: Math.round(parsed * 100),
				});
			}}
		>
			<Field>
				<FieldLabel htmlFor={amountId}>Amount</FieldLabel>
				<Input
					id={amountId}
					autoFocus
					value={amount}
					onChange={(event) => setAmount(event.target.value)}
					inputMode="decimal"
					autoComplete="off"
				/>
			</Field>
			<Field>
				<FieldLabel>Type</FieldLabel>
				<Select value={type} onValueChange={setType}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{PAYMENT_TYPE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel>Method</FieldLabel>
				<Select value={method} onValueChange={setMethod}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{PAYMENT_METHOD_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
		</QuickAddForm>
	);
}

function ContractIncidents({
	contractId,
	vehicleId,
	depositCurrency,
}: {
	contractId: string;
	vehicleId: string;
	depositCurrency: string;
}) {
	const trpc = useTRPC();
	const [adding, setAdding] = useState(false);

	const incidents = useQuery(
		trpc.incidents.listByContract.queryOptions({
			rentalContractId: contractId,
		}),
	);

	const rows = incidents.data ?? [];

	const form = adding ? (
		<ContractIncidentForm
			contractId={contractId}
			vehicleId={vehicleId}
			depositCurrency={depositCurrency}
			onDone={() => setAdding(false)}
		/>
	) : null;

	if (!incidents.isPending && rows.length === 0) {
		return (
			<>
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={Warning}
						title="No incidents"
						description="Nothing has been reported on this contract."
						action={
							<Button
								variant="outline"
								size="sm"
								onClick={() => setAdding(true)}
							>
								<Icon icon={Add} data-icon="inline-start" />
								Report incident
							</Button>
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
					Report incident
				</button>
			)}
		</>
	);
}

function ContractIncidentForm({
	contractId,
	vehicleId,
	depositCurrency,
	onDone,
}: {
	contractId: string;
	vehicleId: string;
	depositCurrency: string;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [description, setDescription] = useState("");
	const [depositOutcome, setDepositOutcome] = useState("NONE");
	const [depositDeductedAmount, setDepositDeductedAmount] = useState("");
	const [document, setDocument] = useState<File | null>(null);
	const [documentType, setDocumentType] = useState("PHOTO");
	const [documentAmount, setDocumentAmount] = useState("");
	const [insuranceReimbursedAmount, setInsuranceReimbursedAmount] =
		useState("");
	const descriptionId = useId();

	const create = useMutation(
		trpc.incidents.create.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = async () => {
		const incident = await create.mutateAsync({
			vehicleId,
			rentalContractId: contractId,
			type: "DAMAGE",
			description,
			depositOutcome: depositOutcome as "NONE" | "PARTIAL" | "FULL",
			depositDeductedAmountCents: depositDeductedAmount
				? Math.round(Number(depositDeductedAmount) * 100)
				: undefined,
			depositCurrency: depositDeductedAmount ? depositCurrency : undefined,
		});

		if (document) {
			const body = new FormData();
			body.append("file", document);
			body.append(
				"type",
				document.type === "application/pdf" ? documentType : "PHOTO",
			);
			if (documentAmount)
				body.append("amountCents", String(Number(documentAmount) * 100));
			if (insuranceReimbursedAmount) {
				body.append(
					"insuranceReimbursedAmountCents",
					String(Number(insuranceReimbursedAmount) * 100),
				);
			}
			body.append("currency", depositCurrency);
			const response = await fetch(`/api/incidents/${incident.id}/documents`, {
				method: "POST",
				body,
			});
			if (!response.ok) {
				toast.error(
					"The incident was saved, but the document failed to upload.",
				);
			}
		}

		await Promise.all([
			cache.rentalContract(contractId),
			cache.vehicle(vehicleId),
		]);
		toast.success("Incident reported.");
		onDone();
	};

	return (
		<QuickAddForm
			submitLabel="Report incident"
			pending={create.isPending}
			ready={description.trim() !== ""}
			onCancel={onDone}
			onSubmit={() => void submit()}
		>
			<Field className="sm:col-span-2">
				<FieldLabel htmlFor={descriptionId}>What happened</FieldLabel>
				<Textarea
					id={descriptionId}
					autoFocus
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					rows={3}
				/>
			</Field>
			<Field>
				<FieldLabel>Deposit outcome</FieldLabel>
				<Select value={depositOutcome} onValueChange={setDepositOutcome}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="NONE">No deposit deduction</SelectItem>
						<SelectItem value="PARTIAL">Partially forfeited</SelectItem>
						<SelectItem value="FULL">Fully forfeited</SelectItem>
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel htmlFor="deposit-deducted">Deposit deducted</FieldLabel>
				<Input
					id="deposit-deducted"
					inputMode="decimal"
					placeholder={`Amount in ${depositCurrency}`}
					value={depositDeductedAmount}
					onChange={(event) => setDepositDeductedAmount(event.target.value)}
				/>
			</Field>
			<Field className="sm:col-span-2">
				<FieldLabel htmlFor="incident-document">
					Photos or police report
				</FieldLabel>
				<Input
					id="incident-document"
					type="file"
					accept="image/jpeg,image/png,image/webp,application/pdf"
					onChange={(event) => setDocument(event.target.files?.[0] ?? null)}
				/>
			</Field>
			{document?.type === "application/pdf" ? (
				<Field>
					<FieldLabel>Document type</FieldLabel>
					<Select value={documentType} onValueChange={setDocumentType}>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="POLICE_REPORT">Police report</SelectItem>
							<SelectItem value="INVOICE">Invoice</SelectItem>
							<SelectItem value="OTHER">Other document</SelectItem>
						</SelectContent>
					</Select>
				</Field>
			) : null}
			{documentType === "INVOICE" ? (
				<>
					<Field>
						<FieldLabel htmlFor="invoice-amount">Invoice amount</FieldLabel>
						<Input
							id="invoice-amount"
							inputMode="decimal"
							placeholder={`Amount in ${depositCurrency}`}
							value={documentAmount}
							onChange={(event) => setDocumentAmount(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="insurance-reimbursed">
							Insurance reimbursed
						</FieldLabel>
						<Input
							id="insurance-reimbursed"
							inputMode="decimal"
							placeholder={`Amount in ${depositCurrency}`}
							value={insuranceReimbursedAmount}
							onChange={(event) =>
								setInsuranceReimbursedAmount(event.target.value)
							}
						/>
					</Field>
				</>
			) : null}
		</QuickAddForm>
	);
}

function ContractInspections({ contract }: { contract: RentalContract }) {
	const trpc = useTRPC();

	const inspections = useQuery(
		trpc.vehicleInspections.listByContract.queryOptions({
			rentalContractId: contract.id,
		}),
	);

	const rows = inspections.data ?? [];
	const checkOut = rows.find((row) => row.type === "CHECK_OUT");
	const checkIn = rows.find((row) => row.type === "CHECK_IN");

	return (
		<DetailSheetBody>
			<DetailSheetSection title="Check-out">
				{checkOut ? (
					<DetailSheetProperties>
						<DetailSheetProperty label="Odometer">
							{checkOut.odometer.toLocaleString()} km
						</DetailSheetProperty>
						<DetailSheetProperty label="Fuel">
							{FUEL_OPTIONS.find((o) => o.value === checkOut.fuelLevel)?.label}
						</DetailSheetProperty>
						<DetailSheetProperty label="When">
							<LocalDateTime
								date={checkOut.inspectedAt}
								options={DATE_OPTIONS}
							/>
						</DetailSheetProperty>
						{checkOut.damageNotes ? (
							<DetailSheetProperty label="Notes" wide>
								{checkOut.damageNotes}
							</DetailSheetProperty>
						) : null}
					</DetailSheetProperties>
				) : (
					<InspectionForm contract={contract} type="CHECK_OUT" />
				)}
			</DetailSheetSection>

			<DetailSheetSection title="Check-in">
				{checkIn ? (
					<DetailSheetProperties>
						<DetailSheetProperty label="Odometer">
							{checkIn.odometer.toLocaleString()} km
						</DetailSheetProperty>
						<DetailSheetProperty label="Fuel">
							{FUEL_OPTIONS.find((o) => o.value === checkIn.fuelLevel)?.label}
						</DetailSheetProperty>
						<DetailSheetProperty label="When">
							<LocalDateTime
								date={checkIn.inspectedAt}
								options={DATE_OPTIONS}
							/>
						</DetailSheetProperty>
						{checkIn.damageNotes ? (
							<DetailSheetProperty label="Notes" wide>
								{checkIn.damageNotes}
							</DetailSheetProperty>
						) : null}
					</DetailSheetProperties>
				) : checkOut ? (
					<InspectionForm contract={contract} type="CHECK_IN" />
				) : (
					<p className="text-muted-foreground text-sm">
						Record the check-out first.
					</p>
				)}
			</DetailSheetSection>
		</DetailSheetBody>
	);
}

function InspectionForm({
	contract,
	type,
}: {
	contract: RentalContract;
	type: "CHECK_OUT" | "CHECK_IN";
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [odometer, setOdometer] = useState("");
	const [fuelLevel, setFuelLevel] = useState("FULL");
	const odometerId = useId();

	const create = useMutation(
		trpc.vehicleInspections.create.mutationOptions({
			onSuccess: async () => {
				await cache.rentalContract(contract.id);
				toast.success(
					type === "CHECK_OUT" ? "Pickup recorded." : "Return recorded.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<div className="flex flex-wrap items-end gap-2">
			<Field className="w-32">
				<FieldLabel htmlFor={odometerId}>Odometer</FieldLabel>
				<Input
					id={odometerId}
					value={odometer}
					onChange={(event) => setOdometer(event.target.value)}
					inputMode="numeric"
				/>
			</Field>
			<Field className="w-32">
				<FieldLabel>Fuel</FieldLabel>
				<Select value={fuelLevel} onValueChange={setFuelLevel}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{FUEL_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Button
				variant="outline"
				size="sm"
				disabled={create.isPending || odometer.trim() === ""}
				onClick={() =>
					create.mutate({
						rentalContractId: contract.id,
						type,
						odometer: Number(odometer) || 0,
						fuelLevel: fuelLevel as never,
					})
				}
			>
				{type === "CHECK_OUT" ? "Record pickup" : "Record return"}
			</Button>
		</div>
	);
}
