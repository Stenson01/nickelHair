import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";
export type CartEntry = {
	product_id: string;
	quantity: number;
};

export type CashOnDeliveryDetails = {
	name: string;
	phone: string;
	address: string;
};

export type CashOnDeliveryResponse = {
	orderId: string;
};

export type CustomerOrderItem = {
	id: string;
	product_name: string;
	unit_price: number | string;
	quantity: number;
};

export type CustomerOrder = {
	id: string;
	status: "pending" | "paid" | "completed" | "cancelled" | "refunded";
	payment_provider: string | null;
	total_amount: number | string;
	delivery_name: string | null;
	delivery_phone: string | null;
	delivery_address: string | null;
	cancellation_reason?: string | null;
	created_at: string;
	completed_at: string | null;
	Order_Items: CustomerOrderItem[];
};

export type ProductReview = {
	id: string;
	product_id: string;
	display_name: string;
	rating: number;
	review_text: string;
	photo_path: string | null;
	photo_url: string | null;
	created_at: string;
};

export type ProductCategory = {
	id: string;
	name: string;
	is_active: boolean;
};

export type ProductDeliveryDetails = {
	product_id: string;
	min_delivery_days: number;
	max_delivery_days: number;
	day_type: "business" | "calendar";
	delivery_fee: number | string;
	delivery_notes: string | null;
};

export type AdminProduct = {
	id: string;
	category_id: string | null;
	name: string;
	description: string | null;
	what_it_does: string | null;
	how_to_use: string | null;
	ingredients: string | null;
	suitable_for: string | null;
	price: number | string;
	image_url: string | null;
	is_active: boolean;
};

const productReviewPhotoBucket = "product-review-photos";
const maxProductReviewPhotoSize = 5 * 1024 * 1024;
const allowedProductReviewPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const productImageBucket = "product-images";
const maxProductImageSize = 5 * 1024 * 1024;
const allowedProductImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

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

	sendPasswordResetEmail(email: string, redirectTo: string) {
		return this.client.auth.resetPasswordForEmail(email, { redirectTo });
	}

	updatePassword(password: string) {
		return this.client.auth.updateUser({ password });
	}

	signOut() {
		return this.client.auth.signOut();
	}

	getCurrentUser() {
		return this.client.auth.getUser();
	}

	recordAnonymousPageView() {
		return this.client.rpc("record_anonymous_page_view");
	}

	async isStoreAdmin(): Promise<boolean> {
		const { data, error } = await this.client.rpc("is_store_admin");
		if (error) throw error;
		if (typeof data !== "boolean") {
			throw new Error("The store administrator check returned an invalid response.");
		}
		return data;
	}

	async getAdminProducts(): Promise<AdminProduct[]> {
		const { data, error } = await this.client
			.from("Products")
			.select("id, category_id, name, description, what_it_does, how_to_use, ingredients, suitable_for, price, image_url, is_active")
			.order("created_at", { ascending: false });
		if (error) throw error;
		return (data ?? []) as AdminProduct[];
	}

	async getAdminCategories(): Promise<ProductCategory[]> {
		const { data, error } = await this.client
			.from("Categories")
			.select("id, name, is_active")
			.order("name");
		if (error) throw error;
		return (data ?? []) as ProductCategory[];
	}

	async saveAdminCategory(name: string): Promise<void> {
		const normalizedName = name.trim();
		if (!normalizedName || normalizedName.length > 100) {
			throw new Error("Category names must contain 1 to 100 characters.");
		}
		const { error } = await this.client.from("Categories").insert({ name: normalizedName });
		if (error) throw error;
	}

	async saveAdminProduct(product: Omit<AdminProduct, "id"> & { id?: string }): Promise<void> {
		const name = product.name.trim();
		const price = Number(product.price);
		if (!name || name.length > 200) throw new Error("Product names must contain 1 to 200 characters.");
		if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid non-negative product price.");

		const values = {
			category_id: product.category_id || null,
			name,
			description: product.description?.trim() || null,
			what_it_does: product.what_it_does?.trim() || null,
			how_to_use: product.how_to_use?.trim() || null,
			ingredients: product.ingredients?.trim() || null,
			suitable_for: product.suitable_for?.trim() || null,
			price,
			image_url: product.image_url?.trim() || null,
			is_active: product.is_active,
		};
		const result = product.id
			? await this.client.from("Products").update(values).eq("id", product.id)
			: await this.client.from("Products").insert(values);
		if (result.error) throw result.error;
	}

	async saveAdminProductWithImage(
		product: Omit<AdminProduct, "id"> & { id?: string },
		image?: File,
	): Promise<void> {
		if (!image) {
			await this.saveAdminProduct(product);
			return;
		}
		if (!allowedProductImageTypes.has(image.type) || image.size > maxProductImageSize) {
			throw new Error("Choose a JPG, PNG, or WebP product image no larger than 5 MB.");
		}

		const extensionByType: Record<string, string> = {
			"image/jpeg": "jpg",
			"image/png": "png",
			"image/webp": "webp",
		};
		const imagePath = `catalog/${crypto.randomUUID()}.${extensionByType[image.type]}`;
		const storage = this.client.storage.from(productImageBucket);
		const { error: uploadError } = await storage.upload(imagePath, image, {
			cacheControl: "3600",
			contentType: image.type,
			upsert: false,
		});
		if (uploadError) throw uploadError;

		const imageUrl = storage.getPublicUrl(imagePath).data.publicUrl;
		try {
			await this.saveAdminProduct({ ...product, image_url: imageUrl });
		} catch (saveError: unknown) {
			try {
				const { error: cleanupError } = await storage.remove([imagePath]);
				if (cleanupError) throw cleanupError;
			} catch (cleanupError: unknown) {
				const saveMessage = saveError instanceof Error ? saveError.message : String(saveError);
				const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
				throw new Error(
					`Unable to save the product: ${saveMessage}. The uploaded image could not be removed: ${cleanupMessage}`,
				);
			}
			throw saveError;
		}
	}

	async getAdminDeliveryDetails(): Promise<ProductDeliveryDetails[]> {
		const { data, error } = await this.client
			.from("Product_Delivery_Details")
			.select("product_id, min_delivery_days, max_delivery_days, day_type, delivery_fee, delivery_notes");
		if (error) throw error;
		return (data ?? []) as ProductDeliveryDetails[];
	}

	async saveAdminDeliveryDetails(details: ProductDeliveryDetails): Promise<void> {
		if (!Number.isInteger(details.min_delivery_days) || details.min_delivery_days < 1) {
			throw new Error("Minimum delivery days must be a positive whole number.");
		}
		if (!Number.isInteger(details.max_delivery_days) || details.max_delivery_days < details.min_delivery_days) {
			throw new Error("Maximum delivery days must be at least the minimum.");
		}
		const deliveryFee = Number(details.delivery_fee);
		if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
			throw new Error("Enter a valid non-negative delivery fee.");
		}
		const deliveryNotes = details.delivery_notes?.trim() || null;
		if (deliveryNotes && deliveryNotes.length > 500) {
			throw new Error("Delivery notes cannot exceed 500 characters.");
		}

		const { error } = await this.client.from("Product_Delivery_Details").upsert({
			...details,
			delivery_fee: deliveryFee,
			delivery_notes: deliveryNotes,
		}, { onConflict: "product_id" });
		if (error) throw error;
	}

	async saveAdminWhatsAppPhone(phone: string): Promise<void> {
		const normalizedPhone = phone.replace(/\D/g, "");
		if (!/^\d{8,15}$/.test(normalizedPhone)) {
			throw new Error("Enter a WhatsApp number in international format.");
		}
		const { error } = await this.client.from("Store_Settings").upsert({
			setting_key: "whatsapp_phone",
			setting_value: normalizedPhone,
		}, { onConflict: "setting_key" });
		if (error) throw error;
	}

	async getAdminWhatsAppPhone(): Promise<string> {
		const { data, error } = await this.client
			.from("Store_Settings")
			.select("setting_value")
			.eq("setting_key", "whatsapp_phone")
			.maybeSingle();
		if (error) throw error;
		return data?.setting_value ?? "";
	}

	async getAdminReviews(): Promise<ProductReview[]> {
		const { data, error } = await this.client
			.from("Product_Reviews")
			.select("id, product_id, display_name, rating, review_text, photo_path, created_at")
			.order("created_at", { ascending: false })
			.limit(200);
		if (error) throw error;
		return (data ?? []).map((review) => ({
			...review,
			photo_url: review.photo_path
				? this.client.storage.from(productReviewPhotoBucket).getPublicUrl(review.photo_path).data.publicUrl
				: null,
		})) as ProductReview[];
	}

	async deleteAdminReview(review: ProductReview): Promise<void> {
		if (review.photo_path) {
			const { error } = await this.client.storage
				.from(productReviewPhotoBucket)
				.remove([review.photo_path]);
			if (error) throw error;
		}
		const { error } = await this.client.from("Product_Reviews").delete().eq("id", review.id);
		if (error) throw error;
	}

	async getProductDeliveryDetails(productId: string): Promise<ProductDeliveryDetails | null> {
		const { data, error } = await this.client
			.from("Product_Delivery_Details")
			.select("product_id, min_delivery_days, max_delivery_days, day_type, delivery_fee, delivery_notes")
			.eq("product_id", productId)
			.maybeSingle();
		if (error) throw error;
		return data as ProductDeliveryDetails | null;
	}

	async getCustomerWhatsAppPhone(): Promise<string> {
		const { data: userData, error: userError } = await this.client.auth.getUser();
		if (userError) throw userError;
		if (!userData.user) throw new Error("Sign in to access the store's WhatsApp contact.");

		const { data, error } = await this.client
			.from("Store_Settings")
			.select("setting_value")
			.eq("setting_key", "whatsapp_phone")
			.single();
		if (error) throw error;

		const phone = typeof data.setting_value === "string"
			? data.setting_value.replace(/\D/g, "")
			: "";
		if (!/^\d{8,15}$/.test(phone)) {
			throw new Error("The store's WhatsApp contact is not configured correctly.");
		}

		return phone;
	}

	async getProductReviews(productId: string): Promise<ProductReview[]> {
		const { data, error } = await this.client
			.from("Product_Reviews")
			.select("id, product_id, display_name, rating, review_text, photo_path, created_at")
			.eq("product_id", productId)
			.order("created_at", { ascending: false })
			.limit(50);
		if (error) throw error;

		return (data ?? []).map((review) => ({
			...review,
			photo_url: review.photo_path
				? this.client.storage.from(productReviewPhotoBucket).getPublicUrl(review.photo_path).data.publicUrl
				: null,
		})) as ProductReview[];
	}

	async canCustomerReviewProduct(productId: string): Promise<boolean> {
		const { data, error } = await this.client.rpc("can_review_product", {
			p_product_id: productId,
		});
		if (error) throw error;
		if (typeof data !== "boolean") {
			throw new Error("The product review eligibility check returned an invalid response.");
		}

		return data;
	}

	async submitProductReview(
		productId: string,
		displayName: string,
		rating: number,
		reviewText: string,
		photo?: File,
	): Promise<void> {
		const { data: userData, error: userError } = await this.client.auth.getUser();
		if (userError) throw userError;
		if (!userData.user) throw new Error("Sign in before submitting a product review.");

		const trimmedName = displayName.trim();
		const trimmedReview = reviewText.trim();
		if (trimmedName.length < 1 || trimmedName.length > 60) {
			throw new Error("Your display name must be between 1 and 60 characters.");
		}
		if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
			throw new Error("Choose a rating between 1 and 5.");
		}
		if (trimmedReview.length < 1 || trimmedReview.length > 1000) {
			throw new Error("Your review must be between 1 and 1000 characters.");
		}
		if (photo && (!allowedProductReviewPhotoTypes.has(photo.type) || photo.size > maxProductReviewPhotoSize)) {
			throw new Error("Choose a JPG, PNG, or WebP photo no larger than 5 MB.");
		}

		let photoPath: string | null = null;
		if (photo) {
			const extensionByType: Record<string, string> = {
				"image/jpeg": "jpg",
				"image/png": "png",
				"image/webp": "webp",
			};
			photoPath = `${userData.user.id}/${crypto.randomUUID()}.${extensionByType[photo.type]}`;
			const { error } = await this.client.storage
				.from(productReviewPhotoBucket)
				.upload(photoPath, photo, { contentType: photo.type, upsert: false });
			if (error) throw error;
		}

		const { error } = await this.client.from("Product_Reviews").insert({
			product_id: productId,
			display_name: trimmedName,
			rating,
			review_text: trimmedReview,
			photo_path: photoPath,
		});
		if (error) {
			if (photoPath) {
				const { error: cleanupError } = await this.client.storage
					.from(productReviewPhotoBucket)
					.remove([photoPath]);
				if (cleanupError) {
					console.error("Unable to remove the uploaded photo after a failed review submission:", cleanupError);
				}
			}
			throw error;
		}
	}

	async getRelatedProducts(categoryId: string, productId: string, limit = 4) {
		return this.client
			.from("Products")
			.select("id, category_id, name, description, what_it_does, how_to_use, ingredients, suitable_for, price, image_url")
			.eq("category_id", categoryId)
			.neq("id", productId)
			.eq("is_active", true)
			.limit(limit);
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

	async placeCashOnDeliveryOrder(
		deliveryDetails: CashOnDeliveryDetails,
	): Promise<CashOnDeliveryResponse> {
		const { data, error } = await this.client.rpc("place_cash_on_delivery_order", {
			p_delivery_name: deliveryDetails.name,
			p_delivery_phone: deliveryDetails.phone,
			p_delivery_address: deliveryDetails.address,
		});
		if (error) {
			const errorDetails = [
				error.message,
				error.details,
				error.hint,
				error.code ? `(${error.code})` : "",
			].filter(Boolean);
			throw new Error(errorDetails.join(" — "));
		}
		if (typeof data !== "string" || !data.trim()) {
			throw new Error("The cash-on-delivery checkout returned an invalid order ID.");
		}

		return { orderId: data };
	}

	async cancelCustomerOrder(orderId: string, reason: string): Promise<void> {
		const trimmedReason = reason.trim();
		if (trimmedReason.length < 1 || trimmedReason.length > 500) {
			throw new Error("Enter a cancellation reason between 1 and 500 characters.");
		}

		const { error } = await this.client.rpc("cancel_customer_order", {
			p_order_id: orderId,
			p_cancellation_reason: trimmedReason,
		});
		if (error) throw error;
	}

	async getCustomerOrders(): Promise<CustomerOrder[]> {
		const { data: userData, error: userError } = await this.client.auth.getUser();
		if (userError) throw userError;
		if (!userData.user) throw new Error("Sign in before loading your orders.");

		const { data, error } = await this.client
			.from("Orders")
			.select("id, status, payment_provider, total_amount, delivery_name, delivery_phone, delivery_address, cancellation_reason, created_at, completed_at, Order_Items(id, product_name, unit_price, quantity)")
			.eq("customer_id", userData.user.id)
			.order("created_at", { ascending: false });
		if (error) throw error;

		return (data ?? []) as CustomerOrder[];
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

	async getProducts() {
		const productsWithCategories = await this.client
			.from("Products")
			.select("id, category_id, name, description, what_it_does, how_to_use, ingredients, suitable_for, price, image_url, Categories(id, name)");

		if (!productsWithCategories.error) {
			return productsWithCategories;
		}

		if (!["PGRST200", "PGRST204", "PGRST205", "42703"].includes(productsWithCategories.error.code)) {
			return productsWithCategories;
		}

		const productsWithoutCategories = await this.client
			.from("Products")
			.select("id, category_id, name, description, what_it_does, how_to_use, ingredients, suitable_for, price, image_url");
		if (!productsWithoutCategories.error) {
			return productsWithoutCategories;
		}
		if (!["PGRST204", "42703"].includes(productsWithoutCategories.error.code)) {
			return productsWithoutCategories;
		}

		return this.client.from("Products").select("id, category_id, name, description, price, image_url");
	}
}

export const supabaseService = new SupabaseService();