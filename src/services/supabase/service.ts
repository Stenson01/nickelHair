import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";
import type { Product } from "../../components/MyProductList";

export type CartEntry = {
	product_id: string;
	quantity: number;
};

export type ProductSearchEventType = "search" | "search_result" | "product_click" | "add_to_cart";

type ProductSearchEvent = {
	event_type: ProductSearchEventType;
	search_term?: string | null;
	product_id?: string | null;
	result_position?: number | null;
};

export type MonCashCheckoutResponse = {
	paymentUrl: string;
};

export class SupabaseService {
	constructor(private readonly configuredClient?: SupabaseClient) {}

	get client(): SupabaseClient {
		return this.configuredClient ?? getSupabaseClient();
	}

	signUp(email: string, password: string) {
		return this.client.auth.signUp({ email, password });
	}

	signIn(email: string, password: string) {
		return this.client.auth.signInWithPassword({ email, password });
	}

	signOut() {
		return this.client.auth.signOut();
	}

	getCurrentUser() {
		return this.client.auth.getUser();
	}

	async getCartItems(): Promise<CartEntry[]> {
		const { data: userData, error: userError } = await this.client.auth.getUser();
		if (userError) throw userError;
		if (!userData.user) throw new Error("Sign in before loading your cart.");

		const { data, error } = await this.client
			.from("Cart")
			.select("product_id, quantity")
			.eq("user_id", userData.user.id);
		if (error) throw error;

		return data;
	}

	async addCartItem(productId: string, quantity: number): Promise<void> {
		const { data: userData, error: userError } = await this.client.auth.getUser();
		if (userError) throw userError;
		if (!userData.user) throw new Error("Sign in before adding items to your cart.");
		if (!Number.isInteger(quantity) || quantity < 1) {
			throw new Error("Cart quantity must be a positive integer.");
		}

		const { error } = await this.client.rpc("add_cart_item", {
			p_product_id: productId,
			p_quantity: quantity,
		});
		if (error) throw error;
	}

	async setCartItemQuantity(productId: string, quantity: number): Promise<void> {
		const { data: userData, error: userError } = await this.client.auth.getUser();
		if (userError) throw userError;
		if (!userData.user) throw new Error("Sign in before updating your cart.");
		if (!Number.isInteger(quantity) || quantity < 0) {
			throw new Error("Cart quantity must be a non-negative integer.");
		}

		if (quantity === 0) {
			const { error } = await this.client
				.from("Cart")
				.delete()
				.eq("user_id", userData.user.id)
				.eq("product_id", productId);
			if (error) throw error;
			return;
		}

		const { error } = await this.client
			.from("Cart")
			.update({ quantity })
			.eq("user_id", userData.user.id)
			.eq("product_id", productId);
		if (error) throw error;
	}

	async startMonCashCheckout(): Promise<MonCashCheckoutResponse> {
		const { data, error } = await this.invokeFunction<MonCashCheckoutResponse>(
			"moncash-checkout",
			{},
		);
		if (error) throw error;
		if (!data || typeof data.paymentUrl !== "string" || !URL.canParse(data.paymentUrl)) {
			throw new Error("The MonCash checkout function returned an invalid payment URL.");
		}

		return data;
	}

	searchProducts(searchTerm: string) {
		const query = searchTerm.trim();
		if (!query) {
			throw new Error("Search term cannot be empty.");
		}
		const escapedQuery = query.replace(/[\\%_]/g, "\\$&");

		return this.client
			.from("Products")
			.select("id, name, description, price, image_url")
			.ilike("name", `%${escapedQuery}%`)
			.limit(20);
	}

	recordProductSearch(searchTerm: string, products: Product[]) {
		const query = searchTerm.trim();
		const events: ProductSearchEvent[] = [
			{ event_type: "search", search_term: query },
			...products.flatMap((product, index) => {
				if (product.id === undefined || product.id === null) return [];
				return [{
					event_type: "search_result" as const,
					search_term: query,
					product_id: String(product.id),
					result_position: index + 1,
				}];
			}),
		];

		return this.client.from("Product_Search_Events").insert(events);
	}

	recordProductEvent(
		eventType: "product_click" | "add_to_cart",
		product: Product,
		searchTerm?: string,
	) {
		if (product.id === undefined || product.id === null) {
			throw new Error("Product id is required to record product interest.");
		}

		return this.client.from("Product_Search_Events").insert({
			event_type: eventType,
			search_term: searchTerm?.trim() || null,
			product_id: String(product.id),
		});
	}

	async recordCategoryInterest(categoryId: string) {
		const { data, error } = await this.client.auth.getUser();
		if (error) {
			throw error;
		}
		if (!data.user) {
			throw new Error("Sign in before recording category interests.");
		}

		return this.client.from("Customer_Category_Interests").upsert(
			{
				customer_id: data.user.id,
				category_id: categoryId,
			},
			{ onConflict: "customer_id,category_id" },
		);
	}

	async getCustomerCategoryInterests() {
		const { data, error } = await this.client.auth.getUser();
		if (error) {
			throw error;
		}
		if (!data.user) {
			throw new Error("Sign in before reading category interests.");
		}

		return this.client
			.from("Customer_Category_Interests")
			.select("category_id, Categories(id, name)")
			.eq("customer_id", data.user.id)
			.order("created_at", { ascending: false });
	}

	getBestSellingProducts(categoryIds: string[], limitPerCategory = 5) {
		return this.client.rpc("get_best_selling_products", {
			p_category_ids: categoryIds,
			p_limit_per_category: limitPerCategory,
		});
	}

	async getRecommendationsForCustomer(limitPerCategory = 5) {
		const { data: userData, error: userError } = await this.client.auth.getUser();
		if (userError) {
			throw userError;
		}
		if (!userData.user) {
			throw new Error("Sign in before loading recommendations.");
		}

		const { data: interests, error: interestsError } = await this.client
			.from("Customer_Category_Interests")
			.select("category_id")
			.eq("customer_id", userData.user.id);
		if (interestsError) {
			throw interestsError;
		}

		const categoryIds = [...new Set(interests.map(({ category_id }) => category_id))];
		return this.getBestSellingProducts(categoryIds, limitPerCategory);
	}

	invokeFunction<TResponse = unknown>(
		functionName: string,
		body?: Record<string, unknown>,
	) {
		return this.client.functions.invoke<TResponse>(functionName, { body });
	}

	async getProducts() {
		const productsWithCategories = await this.client
			.from("Products")
			.select("id, name, description, price, image_url, Categories(id, name)");

		if (!productsWithCategories.error) {
			return productsWithCategories;
		}

		if (!["PGRST200", "PGRST205"].includes(productsWithCategories.error.code)) {
			return productsWithCategories;
		}

		return this.client.from("Products").select("id, name, description, price, image_url");
	}
}

export const supabaseService = new SupabaseService();