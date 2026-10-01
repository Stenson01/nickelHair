import { createClient } from "npm:@supabase/supabase-js@2";

type Product = Record<string, unknown> & {
	id?: string | number;
	code?: string | number;
	product_code?: string | number;
	name?: string;
	product_name?: string;
	price?: string | number;
};

type CartRow = {
	product_id: string;
	quantity: number;
};

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
	return new Response(JSON.stringify(body), {
	status,
	headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

function getProductCode(product: Product): string | null {
	const value = product.code ?? product.product_code ?? product.id;
	if (typeof value !== "string" && typeof value !== "number") return null;

	const code = String(value).trim();
	return code || null;
}

async function getMonCashToken(baseUrl: string, clientId: string, clientSecret: string) {
	const credentials = btoa(`${clientId}:${clientSecret}`);
	const response = await fetch(`${baseUrl}/oauth/token`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${credentials}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "client_credentials",
			scope: "read,write",
		}),
	});

	if (!response.ok) {
		throw new Error(`MonCash authentication failed with status ${response.status}.`);
	}

	const result: unknown = await response.json();
	if (
		!result ||
		typeof result !== "object" ||
		!("access_token" in result) ||
		typeof result.access_token !== "string"
	) {
		throw new Error("MonCash returned an invalid authentication response.");
	}

	return result.access_token;
}

Deno.serve(async (request) => {
	if (request.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed." }, 405);
	}

	const authorization = request.headers.get("Authorization");
	if (!authorization?.startsWith("Bearer ")) {
		return jsonResponse({ error: "Authentication required." }, 401);
	}

	const supabaseUrl = Deno.env.get("SUPABASE_URL");
	const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
	const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	const clientId = Deno.env.get("MONCASH_CLIENT_ID");
	const clientSecret = Deno.env.get("MONCASH_CLIENT_SECRET");

	if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
		console.error("Supabase function environment is incomplete.");
		return jsonResponse({ error: "Payment service is not configured." }, 503);
	}
	if (!clientId || !clientSecret) {
		return jsonResponse({
			error: "MonCash merchant credentials are not configured.",
			errorCode: "MONCASH_NOT_CONFIGURED",
		}, 503);
	}

	const userClient = createClient(supabaseUrl, supabaseAnonKey, {
		global: { headers: { Authorization: authorization } },
		auth: { persistSession: false, autoRefreshToken: false },
	});
	const { data: authData, error: authError } = await userClient.auth.getUser();
	if (authError || !authData.user) {
		return jsonResponse({ error: "A valid signed-in user is required." }, 401);
	}

	const adminClient = createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	let orderId: string | undefined;

	try {
		const [{ data: cartRows, error: cartError }, { data: products, error: productsError }] =
			await Promise.all([
				adminClient
					.from("Cart")
					.select("product_id, quantity")
					.eq("user_id", authData.user.id),
				adminClient.from("Products").select("*"),
			]);

		if (cartError) throw new Error(`Unable to load cart: ${cartError.message}`);
		if (productsError) throw new Error(`Unable to load products: ${productsError.message}`);

		const cart = (cartRows ?? []) as CartRow[];
		if (cart.length === 0) {
			return jsonResponse({ error: "Your cart is empty." }, 400);
		}

		const productsByCode = new Map(
			((products ?? []) as Product[])
				.map((product) => [getProductCode(product), product] as const)
				.filter((entry): entry is readonly [string, Product] => entry[0] !== null),
		);

		const orderItems = cart.map((item) => {
			const product = productsByCode.get(item.product_id);
			if (!product) {
				throw new Error(`Product code ${item.product_id} was not found.`);
			}

			const price = Number(product.price);
			if (!Number.isFinite(price) || price < 0 || !Number.isInteger(item.quantity) || item.quantity < 1) {
				throw new Error(`Product code ${item.product_id} has invalid price or quantity.`);
			}

			return {
				product_id: item.product_id,
				product_name: String(product.name ?? product.product_name ?? item.product_id),
				unit_price: price,
				quantity: item.quantity,
			};
		});
		const amount = Math.round(
			orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0) * 100,
		) / 100;
		if (amount <= 0) {
			return jsonResponse({ error: "The order total must be greater than zero." }, 400);
		}

		orderId = crypto.randomUUID();
		const { error: orderError } = await adminClient
			.from("Orders")
			.insert({
				id: orderId,
				customer_id: authData.user.id,
				status: "pending",
				payment_provider: "moncash",
				moncash_order_id: orderId,
			});
		if (orderError) throw new Error(`Unable to create order: ${orderError.message}`);

		const { error: itemsError } = await adminClient
			.from("Order_Items")
			.insert(orderItems.map((item) => ({ ...item, order_id: orderId })));
		if (itemsError) throw new Error(`Unable to save order items: ${itemsError.message}`);

		const environment = Deno.env.get("MONCASH_ENVIRONMENT");
		const isProduction = environment === "production";
		const baseUrl = isProduction
			? "https://moncashbutton.digicelgroup.com/Api"
			: "https://sandbox.moncashbutton.digicelgroup.com/Api";
		const token = await getMonCashToken(baseUrl, clientId, clientSecret);
		const paymentResponse = await fetch(`${baseUrl}/v1/CreatePayment`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ orderId, amount }),
		});

		if (!paymentResponse.ok) {
			throw new Error(`MonCash payment creation failed with status ${paymentResponse.status}.`);
		}

		const paymentResult: unknown = await paymentResponse.json();
		if (
			!paymentResult ||
			typeof paymentResult !== "object" ||
			!("payment_token" in paymentResult) ||
			!paymentResult.payment_token ||
			typeof paymentResult.payment_token !== "object" ||
			!("token" in paymentResult.payment_token) ||
			typeof paymentResult.payment_token.token !== "string"
		) {
			throw new Error("MonCash returned an invalid payment response.");
		}

		const paymentToken = paymentResult.payment_token.token;
		const redirectUrl = new URL(`${baseUrl}/Payment/Redirect`);
		redirectUrl.searchParams.set("token", paymentToken);

		return jsonResponse({ paymentUrl: redirectUrl.toString(), orderId });
	} catch (error: unknown) {
		if (orderId) {
			const { error: updateError } = await adminClient
				.from("Orders")
				.update({ status: "cancelled" })
				.eq("id", orderId);
			if (updateError) {
				console.error("Unable to mark failed MonCash order as cancelled:", updateError.message);
			}
		}

		console.error("MonCash checkout failed:", error);
		return jsonResponse({
			error: "Unable to start MonCash checkout. Check the Edge Function logs.",
			errorCode: "MONCASH_CHECKOUT_FAILED",
		}, 502);
	}
});
