import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "./i18n/useLanguage";
import MyTopAppBar from "./components/MyTopAppBar";
import MyProductList, { type Product, type ProductFilter } from "./components/MyProductList";
import { getProductCode } from "./components/productUtils";
import CartView, { type CartItem } from "./views/CartView";
import CheckoutView from "./views/CheckoutView";
import { isSupabaseConfigured } from "./services/supabase/client";
import { supabaseService } from "./services/supabase/service";
import LoginView from "./views/LoginView";
import ProfileView from "./views/ProfileView";
import ProductsDetailsView from "./views/ProductsDetailsView";
import SignupView from "./views/SignupView";
import "./App.css";

type AppView = "store" | "login" | "signup" | "profile" | "product-details" | "cart" | "checkout";

type PendingCartAddition = {
	product: Product;
	quantity: number;
	searchTerm?: string;
};

export default function App() {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<ProductFilter>(null);
  const [currentView, setCurrentView] = useState<AppView>("store");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [cartRefreshVersion, setCartRefreshVersion] = useState(0);
  const [pendingCartAddition, setPendingCartAddition] = useState<PendingCartAddition | null>(null);
  const [cartError, setCartError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const recordProductEvent = async (
    eventType: "product_click" | "add_to_cart",
    product: Product,
    eventSearchTerm?: string,
  ) => {
    try {
      const { error } = await supabaseService.recordProductEvent(eventType, product, eventSearchTerm);
      if (error) throw error;
    } catch (error: unknown) {
      console.error(`Unable to record ${eventType} analytics:`, error);
    }
  };

  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value);
    setSelectedFilter(null);
    setCurrentView("store");
  };

  useEffect(() => {
    const query = searchTerm.trim();
    if (!query || !isSupabaseConfigured) return;

    let isCurrentSearch = true;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabaseService.searchProducts(query);
          if (error) throw error;
          if (!isCurrentSearch) return;

          void (async () => {
            try {
              const { error: analyticsError } = await supabaseService.recordProductSearch(
                query,
                (data ?? []) as Product[],
              );
              if (analyticsError) throw analyticsError;
            } catch (analyticsError: unknown) {
              console.error("Unable to record product search analytics:", analyticsError);
            }
          })();
        } catch (error: unknown) {
          if (isCurrentSearch) console.error("Unable to record product search:", error);
        }
      })();
    }, 300);

    return () => {
      isCurrentSearch = false;
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  const persistCartAddition = async ({ product, quantity, searchTerm }: PendingCartAddition) => {
    const productCode = getProductCode(product);
    if (!productCode) {
      setCartError(t("productUnavailableForCart"));
      return false;
    }

    try {
      await supabaseService.addCartItem(productCode, quantity);
      void recordProductEvent("add_to_cart", product, searchTerm);
      setCartItems((items) => {
        const existingItem = items.find((item) => item.key === productCode);
        if (existingItem) {
          return items.map((item) =>
            item.key === productCode ? { ...item, quantity: item.quantity + quantity } : item,
          );
        }
        return [...items, { key: productCode, product, quantity }];
      });
      setCartError("");
      return true;
    } catch (error: unknown) {
      setCartError(error instanceof Error ? error.message : t("unableToLoadCart"));
      return false;
    }
  };

  const addToCart = async (product: Product, quantity: number, searchTerm?: string) => {
    const addition = { product, quantity, searchTerm };
    setCartError("");
    if (!currentUser) {
      setPendingCartAddition(addition);
      setCurrentView("login");
      return;
    }

    await persistCartAddition(addition);
  };

  const handleSignedIn = async () => {
    if (pendingCartAddition) {
      const wasAdded = await persistCartAddition(pendingCartAddition);
      setPendingCartAddition(null);
      setCurrentView(wasAdded ? "cart" : "profile");
      return;
    }
    setCurrentView("profile");
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    const { data: authListener } = supabaseService.client.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    void supabaseService.getCurrentUser().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        console.error("Unable to fetch the current Supabase user:", error.message);
        return;
      }

      setCurrentUser(data.user);
    }).catch((error: unknown) => {
      if (isMounted) {
        console.error("Unable to fetch the current Supabase user:", error);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setCartItems([]);
      setIsCartLoading(false);
      return;
    }

    let isMounted = true;
    setCartError("");
    setIsCartLoading(true);
    void (async () => {
      try {
        const [entries, productsResult] = await Promise.all([
          supabaseService.getCartItems(),
          supabaseService.getProducts(),
        ]);
        if (!isMounted) return;
        if (productsResult.error) throw productsResult.error;

        const productsById = new Map(
          ((productsResult.data ?? []) as Product[])
            .map((product) => [getProductCode(product), product] as const)
            .filter((entry): entry is readonly [string, Product] => entry[0] !== null),
        );
        setCartItems(entries.map(({ product_id, quantity }) => ({
          key: product_id,
          product: productsById.get(product_id) ?? { code: product_id },
          quantity,
        })));
      } catch (error: unknown) {
        if (isMounted) {
          setCartError(error instanceof Error ? error.message : t("unableToLoadCart"));
        }
      } finally {
        if (isMounted) setIsCartLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentUser, cartRefreshVersion, t]);

  const updateCartQuantity = async (key: string, quantity: number) => {
    try {
      await supabaseService.setCartItemQuantity(key, quantity);
      setCartItems((items) =>
        quantity === 0
          ? items.filter((item) => item.key !== key)
          : items.map((item) => item.key === key ? { ...item, quantity } : item),
      );
      setCartError("");
    } catch (error: unknown) {
      setCartError(error instanceof Error ? error.message : t("unableToLoadCart"));
    }
  };

  return (
    <>
      <MyTopAppBar
        currentUser={currentUser}
        onOpenAccount={() => setCurrentView(currentUser ? "profile" : "login")}
        onOpenCart={() => {
          setCurrentView("cart");
          if (currentUser) setCartRefreshVersion((version) => version + 1);
        }}
        cartItemCount={cartItems.reduce((count, item) => count + item.quantity, 0)}
        onSelectProductFilter={setSelectedFilter}
        searchTerm={searchTerm}
        onSearchTermChange={handleSearchTermChange}
      />
      {cartError && <p className="app-cart-error" role="alert">{cartError}</p>}
      {currentView === "store" && (
        <main className="app-main">
          <MyProductList
            selectedFilter={selectedFilter}
            onSelectFilter={setSelectedFilter}
            searchTerm={searchTerm}
            onAddToCart={addToCart}
            onSelectProduct={(product) => {
              void recordProductEvent("product_click", product);
              setSelectedProduct(product);
              setCurrentView("product-details");
            }}
          />
        </main>
      )}
      {currentView === "product-details" && selectedProduct && (
        <ProductsDetailsView
          product={selectedProduct}
          onBack={() => setCurrentView("store")}
          onAddToCart={addToCart}
        />
      )}
      {currentView === "cart" && (
        <CartView
          items={cartItems}
          isLoading={isCartLoading}
          onQuantityChange={updateCartQuantity}
          onRemove={(key) => void updateCartQuantity(key, 0)}
          onContinueShopping={() => setCurrentView("store")}
          onCheckout={() => setCurrentView("checkout")}
        />
      )}
      {currentView === "checkout" && (
        <CheckoutView
          items={cartItems}
          onBackToCart={() => setCurrentView("cart")}
          onStartPayment={async () => {
            const { paymentUrl } = await supabaseService.startMonCashCheckout();
            window.location.assign(paymentUrl);
          }}
        />
      )}
      {currentView === "login" && (
        <LoginView
          onSwitchToSignup={() => setCurrentView("signup")}
          onSignedIn={() => void handleSignedIn()}
        />
      )}
      {currentView === "signup" && (
        <SignupView
          onSwitchToLogin={() => setCurrentView("login")}
          onSignedUp={() => void handleSignedIn()}
        />
      )}
      {currentView === "profile" && currentUser && (
        <ProfileView
          user={currentUser}
          onSignOut={() => {
            setCurrentUser(null);
            setCurrentView("store");
          }}
        />
      )}
    </>
  );
}