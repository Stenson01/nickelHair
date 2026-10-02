import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "./i18n/useLanguage";
import MyTopAppBar from "./components/MyTopAppBar";
import MyProductList, { type Product } from "./components/MyProductList";
import type { ProductFilter, ProductSort } from "./components/productFilterTypes";
import { getProductCode } from "./components/productUtils";
import CartView, { type CartItem } from "./views/CartView";
import CheckoutView from "./views/CheckoutView";
import { isSupabaseConfigured } from "./services/supabase/client";
import { supabaseService } from "./services/supabase/service";
import LoginView from "./views/LoginView";
import ProfileView from "./views/ProfileView";
import ProductsDetailsView from "./views/ProductsDetailsView";
import OrderHistoryView from "./views/OrderHistoryView";
import SignupView from "./views/SignupView";
import "./App.css";

type AppView = "store" | "login" | "signup" | "profile" | "product-details" | "cart" | "checkout" | "orders";

type AppNavigationState = {
	appNavigation: true;
	hasPreviousAppView: boolean;
	view: AppView;
	selectedProduct: Product | null;
};

type PendingCartAddition = {
	product: Product;
	quantity: number;
	searchTerm?: string;
};

function isAppView(value: unknown): value is AppView {
	return value === "store" ||
		value === "login" ||
		value === "signup" ||
		value === "profile" ||
		value === "product-details" ||
		value === "cart" ||
		value === "checkout" ||
		value === "orders";
}

export default function App() {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<ProductFilter>(null);
  const [productSort, setProductSort] = useState<ProductSort>("featured");
  const [currentView, setCurrentView] = useState<AppView>("store");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [cartRefreshVersion, setCartRefreshVersion] = useState(0);
  const [pendingCartAddition, setPendingCartAddition] = useState<PendingCartAddition | null>(null);
  const [pendingViewAfterAuth, setPendingViewAfterAuth] = useState<AppView | null>(null);
  const [cartError, setCartError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const navigateToView = (
    view: AppView,
    product: Product | null = null,
    replaceCurrent = false,
  ) => {
    const state: AppNavigationState = {
      appNavigation: true,
      hasPreviousAppView: replaceCurrent
        ? window.history.state?.hasPreviousAppView === true
        : window.history.state?.appNavigation === true,
      view,
      selectedProduct: product,
    };
    if (replaceCurrent) {
      window.history.replaceState(state, "");
    } else {
      window.history.pushState(state, "");
    }
    setSelectedProduct(product);
    setCurrentView(view);
  };

  const goBack = (fallbackView: AppView = "store") => {
    const state = window.history.state as Partial<AppNavigationState> | null;
    if (state?.appNavigation && state.hasPreviousAppView) {
      window.history.back();
      return;
    }

    navigateToView(fallbackView);
  };

  useEffect(() => {
    const initialState: AppNavigationState = {
      appNavigation: true,
      hasPreviousAppView: false,
      view: "store",
      selectedProduct: null,
    };
    window.history.replaceState(initialState, "");

    const restoreView = (event: PopStateEvent) => {
      const state = event.state as Partial<AppNavigationState> | null;
      if (!state?.appNavigation || !isAppView(state.view)) {
        setSelectedProduct(null);
        setCurrentView("store");
        return;
      }

      setSelectedProduct(state.selectedProduct ?? null);
      setCurrentView(state.view);
    };

    window.addEventListener("popstate", restoreView);
    return () => window.removeEventListener("popstate", restoreView);
  }, []);

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
    if (currentView !== "store") navigateToView("store");
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
      navigateToView("login");
      return;
    }

    await persistCartAddition(addition);
  };

  const handleSignedIn = async () => {
    if (pendingCartAddition) {
      const wasAdded = await persistCartAddition(pendingCartAddition);
      setPendingCartAddition(null);
      navigateToView(wasAdded ? "cart" : "profile", null, true);
      return;
    }
    if (pendingViewAfterAuth) {
      const nextView = pendingViewAfterAuth;
      setPendingViewAfterAuth(null);
      navigateToView(nextView, null, true);
      return;
    }
    navigateToView("profile", null, true);
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
      {currentView === "store" && <MyTopAppBar
        currentUser={currentUser}
        onOpenAccount={() => navigateToView(currentUser ? "profile" : "login")}
        onOpenCart={() => {
          navigateToView("cart");
          if (currentUser) setCartRefreshVersion((version) => version + 1);
        }}
        onOpenOrders={() => {
          if (currentUser) {
            navigateToView("orders");
          } else {
            setPendingViewAfterAuth("orders");
            navigateToView("login");
          }
        }}
        cartItemCount={cartItems.reduce((count, item) => count + item.quantity, 0)}
        selectedFilter={selectedFilter}
        onSelectProductFilter={setSelectedFilter}
        productSort={productSort}
        onSelectProductSort={setProductSort}
        searchTerm={searchTerm}
        onSearchTermChange={handleSearchTermChange}
      />}
      {currentView !== "store" && (
        <div className="app-home-navigation">
          <button
            className="app-home-navigation__button"
            type="button"
            onClick={() => goBack()}
          >
            <ArrowLeft aria-hidden="true" />
            {t("backToPrevious")}
          </button>
        </div>
      )}
      {cartError && <p className="app-cart-error" role="alert">{cartError}</p>}
      {currentView === "store" && (
        <main className="app-main app-main--store">
          <MyProductList
            selectedFilter={selectedFilter}
            onSelectFilter={setSelectedFilter}
            sort={productSort}
            onSelectSort={setProductSort}
            searchTerm={searchTerm}
            onAddToCart={addToCart}
            onSelectProduct={(product) => {
              void recordProductEvent("product_click", product);
              navigateToView("product-details", product);
            }}
          />
        </main>
      )}
      {currentView === "product-details" && selectedProduct && (
        <ProductsDetailsView
          product={selectedProduct}
          onAddToCart={addToCart}
        />
      )}
      {currentView === "cart" && (
        <CartView
          items={cartItems}
          isLoading={isCartLoading}
          onQuantityChange={updateCartQuantity}
          onRemove={(key) => void updateCartQuantity(key, 0)}
          onCheckout={() => navigateToView("checkout")}
        />
      )}
      {currentView === "checkout" && (
        <CheckoutView
          items={cartItems}
          onStartPayment={async () => {
            const { paymentUrl } = await supabaseService.startMonCashCheckout();
            window.location.assign(paymentUrl);
          }}
          onPlaceCashOnDeliveryOrder={async (details) => {
            const { orderId } = await supabaseService.placeCashOnDeliveryOrder(details);
            return orderId;
          }}
          onContinueShopping={() => {
            setCartItems([]);
            navigateToView("store");
          }}
        />
      )}
      {currentView === "orders" && <OrderHistoryView />}
      {currentView === "login" && (
        <LoginView
          onSwitchToSignup={() => navigateToView("signup")}
          onSignedIn={() => void handleSignedIn()}
        />
      )}
      {currentView === "signup" && (
        <SignupView
          onSwitchToLogin={() => navigateToView("login")}
          onSignedUp={() => void handleSignedIn()}
        />
      )}
      {currentView === "profile" && currentUser && (
        <ProfileView
          user={currentUser}
          onSignOut={() => {
            setCurrentUser(null);
            navigateToView("store", null, true);
          }}
        />
      )}
    </>
  );
}