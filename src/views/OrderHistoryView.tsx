import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n/useLanguage";
import {
	supabaseService,
	type CustomerOrder,
} from "../services/supabase/service";
import { formatCartAmount } from "./cartUtils";
import "./OrderHistoryView.css";

type OrderFilter = "recent" | "active" | "completed" | "cancelled";

const orderFilters: { id: OrderFilter; label: "recentOrders" | "activeOrders" | "completedOrders" | "cancelledOrders" }[] = [
	{ id: "recent", label: "recentOrders" },
	{ id: "active", label: "activeOrders" },
	{ id: "completed", label: "completedOrders" },
	{ id: "cancelled", label: "cancelledOrders" },
];

function orderMatchesFilter(order: CustomerOrder, filter: OrderFilter) {
	switch (filter) {
		case "active":
			return order.status === "pending" || order.status === "paid";
		case "completed":
			return order.status === "completed";
		case "cancelled":
			return order.status === "cancelled" || order.status === "refunded";
		case "recent":
			return true;
	}
}

function OrderStatus({ status }: { status: CustomerOrder["status"] }) {
	const { t } = useLanguage();
	const labels: Record<CustomerOrder["status"], "orderStatusPending" | "orderStatusPaid" | "orderStatusCompleted" | "orderStatusCancelled" | "orderStatusRefunded"> = {
		pending: "orderStatusPending",
		paid: "orderStatusPaid",
		completed: "orderStatusCompleted",
		cancelled: "orderStatusCancelled",
		refunded: "orderStatusRefunded",
	};

	return <span className={`order-history__status order-history__status--${status}`}>{t(labels[status])}</span>;
}

export default function OrderHistoryView() {
	const { language, t } = useLanguage();
	const [orders, setOrders] = useState<CustomerOrder[]>([]);
	const [filter, setFilter] = useState<OrderFilter>("recent");
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState("");
	const dateLocale = language === "fr" ? "fr-HT" : "ht-HT";
	const currencyLocale = language === "fr" ? "fr-HT" : "ht-HT";

	useEffect(() => {
		let isMounted = true;

		void supabaseService.getCustomerOrders()
			.then((customerOrders) => {
				if (isMounted) setOrders(customerOrders);
			})
			.catch((error: unknown) => {
				if (isMounted) {
					setErrorMessage(error instanceof Error ? error.message : t("ordersLoadError"));
				}
			})
			.finally(() => {
				if (isMounted) setIsLoading(false);
			});

		return () => {
			isMounted = false;
		};
	}, [t]);

	const visibleOrders = useMemo(
		() => orders.filter((order) => orderMatchesFilter(order, filter)),
		[filter, orders],
	);

	return (
		<main className="order-history">
			<header className="order-history__header">
				<h1>{t("myOrders")}</h1>
				<p>{t("orderHistoryDescription")}</p>
			</header>
			<div className="order-history__filters" role="group" aria-label={t("orderFilters")}>
				{orderFilters.map(({ id, label }) => (
					<button
						className={`order-history__filter${filter === id ? " is-selected" : ""}`}
						key={id}
						type="button"
						aria-pressed={filter === id}
						onClick={() => setFilter(id)}
					>
						{t(label)}
					</button>
				))}
			</div>
			{isLoading && <p className="order-history__message" role="status">{t("ordersLoading")}</p>}
			{!isLoading && errorMessage && <p className="order-history__message order-history__message--error" role="alert">{errorMessage}</p>}
			{!isLoading && !errorMessage && orders.length === 0 && (
				<p className="order-history__message">{t("noOrders")}</p>
			)}
			{!isLoading && !errorMessage && orders.length > 0 && visibleOrders.length === 0 && (
				<p className="order-history__message">{t("noOrdersInFilter")}</p>
			)}
			{visibleOrders.length > 0 && (
				<ul className="order-history__list">
					{visibleOrders.map((order) => (
						<li className="order-history__card" key={order.id}>
							<div className="order-history__card-header">
								<div>
									<p className="order-history__order-number">{t("orderNumber")}</p>
									<strong>{order.id}</strong>
								</div>
								<OrderStatus status={order.status} />
							</div>
							<p className="order-history__date">
								{new Intl.DateTimeFormat(dateLocale, {
									dateStyle: "medium",
									timeStyle: "short",
								}).format(new Date(order.created_at))}
							</p>
							<ul className="order-history__items">
								{order.Order_Items.map((item) => (
									<li key={item.id}>
										<span>{item.product_name} × {item.quantity}</span>
										<strong>
											{formatCartAmount(Number(item.unit_price) * item.quantity, currencyLocale)}
										</strong>
									</li>
								))}
							</ul>
							<p className="order-history__total">
								<span>{t("subtotal")}</span>
								<strong>{formatCartAmount(Number(order.total_amount), currencyLocale)}</strong>
							</p>
							{order.delivery_address && (
								<p className="order-history__delivery">
									<span>{t("deliveryAddress")}: </span>
									{order.delivery_address}
								</p>
							)}
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
