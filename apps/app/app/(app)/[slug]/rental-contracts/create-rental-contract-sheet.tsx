"use client";

import Add from "@carbon/icons-react/es/Add";
import { Button } from "@crm/ui/components/button";
import { DatePicker } from "@crm/ui/components/date-picker";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@crm/ui/components/sheet";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { parseAsBoolean, useQueryState } from "nuqs";
import { type ComponentProps, Suspense, useId, useState } from "react";
import { toast } from "sonner";
import { contactName } from "@/components/crm/contact-name";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const UNSET = "";

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			New rental contract
		</Button>
	);
}

export function CreateRentalContractSheet() {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<CreateRentalContractForm />
		</Suspense>
	);
}

function CreateRentalContractForm() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [open, setOpen] = useQueryState(
		"new",
		parseAsBoolean.withDefault(false),
	);
	const [vehicleId, setVehicleId] = useState(UNSET);
	const [contactId, setContactId] = useState(UNSET);
	const [ownerId, setOwnerId] = useState(UNSET);
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [pricePerDay, setPricePerDay] = useState("");
	const [depositAmount, setDepositAmount] = useState("");

	const pricePerDayId = useId();
	const depositId = useId();

	const users = useQuery(trpc.users.list.queryOptions());
	const me = useQuery(trpc.users.me.queryOptions());
	const vehicles = useQuery(
		trpc.vehicles.list.queryOptions({
			q: "",
			sort: "",
			dir: "asc",
			page: 1,
			pageSize: 100,
			owner: "all",
			status: "AVAILABLE",
			type: "all",
		}),
	);
	const contacts = useQuery(trpc.contacts.options.queryOptions({ q: "" }));

	const resolvedOwner = ownerId || me.data?.id || UNSET;

	const create = useMutation(
		trpc.rentalContracts.create.mutationOptions({
			onSuccess: async (contract) => {
				await cache.rentalContract(contract.id);
				toast.success("Rental contract created.");
				await setOpen(null);
				setVehicleId(UNSET);
				setContactId(UNSET);
				setStartDate("");
				setEndDate("");
				setPricePerDay("");
				setDepositAmount("");
				openRecord({ kind: "rentalContract", id: contract.id });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const ready =
		vehicleId !== UNSET &&
		contactId !== UNSET &&
		resolvedOwner !== UNSET &&
		startDate !== "" &&
		endDate !== "" &&
		pricePerDay.trim() !== "" &&
		depositAmount.trim() !== "";

	return (
		<Sheet open={open} onOpenChange={(next) => setOpen(next || null)}>
			<SheetTrigger asChild>
				<AddButton />
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>New rental contract</SheetTitle>
					<SheetDescription>
						Book a vehicle for a renter over a date range.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-rental-contract"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						const price = Number.parseFloat(pricePerDay);
						const deposit = Number.parseFloat(depositAmount);
						if (!Number.isFinite(price) || price < 0) {
							toast.error("Price per day has to be a number.");
							return;
						}
						if (!Number.isFinite(deposit) || deposit < 0) {
							toast.error("Deposit has to be a number.");
							return;
						}
						create.mutate({
							vehicleId,
							contactId,
							ownerId: resolvedOwner,
							startDate,
							endDate,
							pricePerDayCents: Math.round(price * 100),
							depositAmountCents: Math.round(deposit * 100),
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="create-contract-vehicle">Vehicle</FieldLabel>
							<Select value={vehicleId} onValueChange={setVehicleId}>
								<SelectTrigger id="create-contract-vehicle">
									<SelectValue placeholder="Choose an available vehicle" />
								</SelectTrigger>
								<SelectContent>
									{(vehicles.data?.rows ?? []).map((vehicle) => (
										<SelectItem key={vehicle.id} value={vehicle.id}>
											{vehicle.make} {vehicle.model} · {vehicle.plateNumber}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contract-contact">Renter</FieldLabel>
							<Select value={contactId} onValueChange={setContactId}>
								<SelectTrigger id="create-contract-contact">
									<SelectValue placeholder="Choose a renter" />
								</SelectTrigger>
								<SelectContent>
									{(contacts.data ?? []).map((contact) => (
										<SelectItem key={contact.id} value={contact.id}>
											{contactName(contact)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contract-owner">Agent</FieldLabel>
							<Select value={resolvedOwner} onValueChange={setOwnerId}>
								<SelectTrigger id="create-contract-owner">
									<SelectValue placeholder="Choose an agent" />
								</SelectTrigger>
								<SelectContent>
									{(users.data ?? []).map((user) => (
										<SelectItem key={user.id} value={user.id}>
											{user.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contract-start">
								Start date
							</FieldLabel>
							<DatePicker
								id="create-contract-start"
								value={startDate}
								onChange={setStartDate}
								placeholder="Pickup date"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-contract-end">End date</FieldLabel>
							<DatePicker
								id="create-contract-end"
								value={endDate}
								onChange={setEndDate}
								placeholder="Return date"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={pricePerDayId}>Price per day</FieldLabel>
							<Input
								id={pricePerDayId}
								value={pricePerDay}
								onChange={(event) => setPricePerDay(event.target.value)}
								placeholder="45"
								inputMode="decimal"
								autoComplete="off"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={depositId}>Deposit</FieldLabel>
							<Input
								id={depositId}
								value={depositAmount}
								onChange={(event) => setDepositAmount(event.target.value)}
								placeholder="90"
								inputMode="decimal"
								autoComplete="off"
							/>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-rental-contract"
						disabled={create.isPending || !ready}
					>
						{create.isPending ? <Spinner /> : null}
						Create contract
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
