import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";

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

	searchProducts(searchTerm: string) {
		const query = searchTerm.trim();
		if (!query) {
			throw new Error("Search term cannot be empty.");
		}

		return this.client
			.from("Products")
			.select(
				"id, name, description, price, image_url, category_id, Categories(id, name)",
			)
			.eq("is_active", true)
			.ilike("name", `%${query}%`)
			.limit(20);
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
			.select("*, Categories(id, name)");

		if (!productsWithCategories.error) {
			return productsWithCategories;
		}

		if (!["PGRST200", "PGRST205"].includes(productsWithCategories.error.code)) {
			return productsWithCategories;
		}

		return this.client.from("Products").select("*");
	}
}

export const supabaseService = new SupabaseService();