import { useEffect, useMemo, useState } from "react";
const API = "http://localhost:5000/api";
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
const initial = {
  bases: [
    "Classic Hand Tossed",
    "Thin Crust",
    "Cheese Burst",
    "Whole Wheat",
    "Gluten Free",
  ],
  sauces: ["Classic Tomato", "Spicy Marinara", "Pesto", "BBQ", "White Garlic"],
  cheeses: ["Mozzarella", "Cheddar", "Parmesan", "Vegan Cheese"],
  vegetables: [
    "Capsicum",
    "Onion",
    "Sweet Corn",
    "Olives",
    "Mushrooms",
    "Tomato",
    "Jalapeños",
  ],
};
const statuses = ["Order Received", "In Kitchen", "Sent to Delivery"];
export default function App() {
  const [token, setToken] = useState(
  localStorage.getItem("pizzaToken") || ""
);
const [currentUser, setCurrentUser] = useState(
  JSON.parse(localStorage.getItem("pizzaUser") || "null")
);
const [authMode, setAuthMode] = useState("login");
const [loginType, setLoginType] = useState("user");
const [authName, setAuthName] = useState("");
const [authEmail, setAuthEmail] = useState("");
const [authPassword, setAuthPassword] = useState("");
  const [view, setView] = useState("build"),
    [menu, setMenu] = useState(initial),
    [base, setBase] = useState(initial.bases[0]),
    [sauce, setSauce] = useState(initial.sauces[0]),
    [cheese, setCheese] = useState(initial.cheeses[0]),
    [vegs, setVegs] = useState(["Capsicum", "Onion"]),
    [name, setName] = useState(""),
    [orders, setOrders] = useState([]),
    [inventory, setInventory] = useState([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const price = useMemo(
    () => 249 + vegs.length * 15 + (base === "Cheese Burst" ? 50 : 0),
    [base, vegs.length],
  );
  async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });

  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw Error(d.message || "API request failed");
  }

  return d;
}
async function submitAuth(e) {
  e.preventDefault();
  setBusy(true);
  setNotice("");

  try {
    if (authMode === "forgot") {
      const result = await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email: authEmail,
        }),
      });

      setNotice(result.message);
      return;
    }
    if (authMode === "register") {
      const result = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword,
        }),
      });

      setNotice(
        result.message || "Account created. Please verify your email."
      );

      setAuthMode("login");
      setAuthPassword("");
    } else {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
        }),
      });
      if (result.user.role !== loginType) {
  throw Error(
    loginType === "admin"
      ? "Admin account required."
      : "Please use User Login."
  );
}

      localStorage.setItem("pizzaToken", result.token);
      localStorage.setItem("pizzaUser", JSON.stringify(result.user));

      setToken(result.token);
      setCurrentUser(result.user);
      setAuthPassword("");
      setView("build");
      setNotice("Login successful!");
    }
  } catch (error) {
    setNotice(error.message);
  } finally {
    setBusy(false);
  }
}
  async function refresh() {
  try {
    const [m, o, i] = await Promise.all([
      api("/menu"),
      token ? api("/orders") : Promise.resolve([]),
      token && currentUser?.role === "admin"
        ? api("/admin/inventory")
        : Promise.resolve([])
    ]);

    setMenu(m);
    setOrders(o);
    setInventory(i);

  } catch (error) {
    console.log("Refresh error:", error.message);
  }
}
 useEffect(() => {
  refresh();

  const t = setInterval(refresh, 5000);

  return () => clearInterval(t);
}, [token, currentUser]);

    if (!token) {
      const resetToken = new URLSearchParams(window.location.search).get("token");

if (resetToken) {
  return (
    <div className="shell">
      <div style={{
        maxWidth: "420px",
        margin: "80px auto",
        padding: "30px",
        background: "white",
        borderRadius: "15px"
      }}>
        <h2>Reset Your Password</h2>

        <form onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setNotice("");

          try {
            const result = await api("/auth/reset-password", {
              method: "POST",
              body: JSON.stringify({
                token: resetToken,
                newPassword: authPassword
              })
            });

            setNotice(result.message);
            setAuthPassword("");
            window.history.replaceState({}, "", window.location.pathname);
          } catch (error) {
            setNotice(error.message);
          } finally {
            setBusy(false);
          }
        }}>
          <input
            type="password"
            placeholder="New Password (minimum 8 characters)"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            minLength={8}
            required
          />

          <button type="submit" disabled={busy}>
            {busy ? "Please wait..." : "Reset Password"}
          </button>
        </form>

        <p>{notice}</p>
      </div>
    </div>
  );
}
  return (
    <div className="shell">
      <div style={{
        maxWidth: "420px",
        margin: "80px auto",
        padding: "30px",
        background: "white",
        borderRadius: "15px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
      }}>
        <h1 style={{ textAlign: "center" }}>
          🍕 Pizza<span className="red">Craft</span>
        </h1>

        <h2 style={{ textAlign: "center" }}>
          {authMode === "login" ? "Welcome Back!" : "Create Account"}
        </h2>

        <form onSubmit={submitAuth}>
          {authMode === "login" && (
  <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
    <button
      type="button"
      onClick={() => setLoginType("user")}
      className={loginType === "user" ? "primary" : ""}
    >
      User Login
    </button>

    <button
      type="button"
      onClick={() => setLoginType("admin")}
      className={loginType === "admin" ? "primary" : ""}
    >
      Admin Login
    </button>
  </div>
)}

  {authMode === "register" && (
    <input
      type="text"
      placeholder="Full Name"
      value={authName}
      onChange={(e) => setAuthName(e.target.value)}
      required
      minLength={2}
    />
  )}

  <input
    type="email"
    placeholder="Email Address"
    value={authEmail}
    onChange={(e) => setAuthEmail(e.target.value)}
    required
  />

  {authMode !== "forgot" && (
    <input
      type="password"
      placeholder="Password (minimum 8 characters)"
      value={authPassword}
      onChange={(e) => setAuthPassword(e.target.value)}
      required
      minLength={8}
    />
  )}

  <button
    type="submit"
    className="primary"
    disabled={busy}
    style={{ width: "100%", marginTop: "15px" }}
  >
    {busy
      ? "Please wait..."
      : authMode === "login"
        ? "Login"
        : authMode === "register"
          ? "Create Account"
          : "Send Reset Link"}
  </button>

  {authMode === "login" && (
    <button
      type="button"
      onClick={() => {
        setAuthMode("forgot");
        setNotice("");
      }}
    >
      Forgot Password?
    </button>
  )}

  {authMode === "forgot" && (
    <button
      type="button"
      onClick={() => {
        setAuthMode("login");
        setNotice("");
      }}
    >
      Back to Login
    </button>
  )}

</form>
        {notice && (
          <p style={{ textAlign: "center", marginTop: "15px" }}>
            {notice}
          </p>
        )}

        <p style={{ textAlign: "center", marginTop: "20px" }}>
          {authMode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === "login" ? "register" : "login");
              setNotice("");
            }}
            style={{
              border: "none",
              background: "none",
              color: "#e63946",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            {authMode === "login" ? " Sign Up" : " Login"}
          </button>
        </p>
      </div>
    </div>
  );
}
    
  function toggle(v) {
    setVegs((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));
  }
  async function place() {
    setBusy(true);
    setNotice("");
    try {
      const o = await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: name,
          pizza: { base, sauce, cheese, vegetables: vegs },
          amount: price,
        }),
      });
      setNotice(
       `Order #${o._id || o.id} created. Payment is simulated in this starter.`,
      );
      await refresh();
      setView("orders");
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function pay(o) {
  setBusy(true);
  setNotice("");

  try {
    const loaded = await loadRazorpayScript();

    if (!loaded) {
      throw new Error("Razorpay Checkout could not be loaded.");
    }

    const appOrderId = o._id || o.id;

    const paymentOrder = await api("/payment/create-order", {
      method: "POST",
      body: JSON.stringify({ appOrderId }),
    });

    const options = {
      key: paymentOrder.keyId,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      name: "PizzaCraft",
      description: `Pizza order #${appOrderId}`,
      order_id: paymentOrder.id,

      handler: async function (response) {
        try {
          setNotice("Verifying payment...");

          await api("/payment/verify", {
            method: "POST",
            body: JSON.stringify({
              appOrderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          setNotice(
            `Payment verified successfully for order #${appOrderId}.`,
          );

          await refresh();
        } catch (error) {
          setNotice(
            `Payment verification needs attention: ${error.message}`,
          );
          await refresh();
        }
      },

      modal: {
        ondismiss: function () {
          setNotice("Checkout closed. Check payment status before retrying.");
        },
      },

      theme: {
        color: "#e53935",
      },
    };

    const checkout = new window.Razorpay(options);

    checkout.on("payment.failed", function (response) {
      setNotice(
        response.error?.description || "Test payment failed. Please retry.",
      );
    });

    checkout.open();
  } catch (error) {
    setNotice(error.message);
  } finally {
    setBusy(false);
  }
}
  async function status(o, s) {
  try {
    const orderId = o._id || o.id;

    await api(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: s }),
    });

    await refresh();
  } catch (e) {
    setNotice(e.message);
  }
}
  async function stock(i, v) {

    try {
      await api(`/admin/inventory/${i.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stock: Number(v) }),
      });
      await refresh();
    } catch (e) {
      setNotice(e.message);
    }
  }
  function logout() {
  localStorage.removeItem("pizzaToken");
  localStorage.removeItem("pizzaUser");

  setToken("");
  setCurrentUser(null);
  setOrders([]);
  setInventory([]);
  setView("build");
  setNotice("");
  setAuthMode("login");
}
  const options = (arr, val, set, icons = []) => (
    <div className="options">
      {arr.map((x, i) => (
        <button
          key={x}
          className={val === x ? "choice chosen" : "choice"}
          onClick={() => set(x)}
        >
          <span>{icons[i] || "✦"}</span>
          {x}
          {val === x && <b>✓</b>}
        </button>
      ))}
    </div>
  );
  return (
    <div className="shell">
      <header>
        <div className="logo">
          🍕{" "}
          <span>
            Pizza<span className="red">Craft</span>
            <small>BUILD YOUR PERFECT SLICE</small>
          </span>
        </div>
        <nav>
          <button
            onClick={() => setView("build")}
            className={view === "build" ? "active" : ""}
          >
            Build Pizza
          </button>
          <button
            onClick={() => setView("orders")}
            className={view === "orders" ? "active" : ""}
          >
            My Orders
          </button>
          {currentUser?.role === "admin" && (
  <button
    onClick={() => setView("admin")}
    className={view === "admin" ? "active" : ""}
  >
    Admin Dashboard
  </button>
)}
<button onClick={logout}>
  Logout
</button>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">FRESHLY MADE, JUST FOR YOU</p>
            <h1>
              Every great pizza
              <br />
              <span className="red">starts with you.</span>
            </h1>
            <p className="sub">
              Choose your base, layer on your favourites, and make a pizza that
              is completely yours.
            </p>
            <button className="primary" onClick={() => setView("build")}>
              Create your pizza ↗
            </button>
          </div>
          <div className="hero-pizza">
            🍕<span>✦ Made your way</span>
          </div>
        </section>
        {notice && (
          <div className="notice">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        {view === "build" && (
          <div className="layout">
            <section className="card builder">
              <p className="eyebrow">THE FUN PART</p>
              <h2>Build your pizza</h2>
              <div className="step">
                <h3>
                  <i>01</i> Choose your base
                </h3>
                {options(menu.bases, base, setBase, [
                  "🥯",
                  "🫓",
                  "🧀",
                  "🌾",
                  "🌿",
                ])}
              </div>
              <div className="step">
                <h3>
                  <i>02</i> Pick a sauce
                </h3>
                {options(menu.sauces, sauce, setSauce, [
                  "🍅",
                  "🌶️",
                  "🌿",
                  "🍖",
                  "🧄",
                ])}
              </div>
              <div className="step">
                <h3>
                  <i>03</i> Say cheese
                </h3>
                {options(menu.cheeses, cheese, setCheese, [
                  "🧀",
                  "🧀",
                  "🧀",
                  "🌱",
                ])}
              </div>
              <div className="step">
                <h3>
                  <i>04</i> Load up the veggies
                </h3>
                <div className="options">
                  {menu.vegetables.map((v, i) => (
                    <button
                      key={v}
                      className={vegs.includes(v) ? "choice chosen" : "choice"}
                      onClick={() => toggle(v)}
                    >
                      <span>
                        {["🫑", "🧅", "🌽", "🫒", "🍄", "🍅", "🌶️"][i]}
                      </span>
                      {v}
                      {vegs.includes(v) && <b>✓</b>}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <aside className="card summary">
              <div className="summary-top">
                YOUR CREATION <span>● LIVE PREVIEW</span>
              </div>
              <div className="preview">🍕</div>
              <h3>Your custom pizza</h3>
              <p className="sub">Made fresh, just for you.</p>
              <div className="line">
                <span>Base</span>
                <b>{base}</b>
              </div>
              <div className="line">
                <span>Sauce</span>
                <b>{sauce}</b>
              </div>
              <div className="line">
                <span>Cheese</span>
                <b>{cheese}</b>
              </div>
              <div className="line">
                <span>Veggies</span>
                <b>{vegs.join(", ") || "None"}</b>
              </div>
              <label>Your name (optional)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
              />
              <div className="total">
                <span>Estimated total</span>
                <b>₹{price}</b>
              </div>
              <button className="primary full" disabled={busy} onClick={place}>
                {busy ? "Please wait…" : "Continue to order summary →"}
              </button>
              <p className="fine">Demo only · No real payment taken</p>
            </aside>
          </div>
        )}
        {view === "orders" && (
          <section className="card panel">
            <p className="eyebrow">FRESH FROM THE OVEN</p>
            <h2>Order tracking</h2>
            <p className="sub">Status refreshes every 5 seconds.</p>
            {!orders.length ? (
              <div className="empty">
                🛵<h3>No orders yet</h3>
                <button className="primary" onClick={() => setView("build")}>
                  Build a pizza
                </button>
              </div>
            ) : (
              orders.map((o) => (
                <article className="order" key={o._id || o.id}>
                  <div className="orderhead">
                    <div>
                      <small>ORDER #{o.id}</small>
                      <h3>{o.customerName}</h3>
                    </div>
                    <b>₹{o.amount}</b>
                  </div>
                  <p>
                    {o.pizza.base} · {o.pizza.sauce} · {o.pizza.cheese}
                  </p>
                  <div className="progress">
                    {statuses.map((s, i) => (
                      <span
                        key={s}
                        className={
                          statuses.indexOf(o.status) >= i ? "done" : ""
                        }
                      >
                        ● {s}
                      </span>
                    ))}
                  </div>
                  <div className="orderfoot">
                    <small>{o.paymentStatus}</small>
                    {o.paymentStatus === "Demo payment pending" && (
                      <button className="secondary" onClick={() => pay(o)}>
                        Pay with Razorpay
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </section>
        )}
        {view === "admin" && (
          <section className="card panel">
            <p className="eyebrow">RESTAURANT CONTROL CENTRE</p>
            <h2>Admin dashboard</h2>
            <p className="sub">Manage inventory and customer orders.</p>
            <div className="inventory">
              {inventory.map((i) => (
                <div className="inv" key={i.id}>
                  <span>
                    {i.id === "base"
                      ? "🥯"
                      : i.id === "sauce"
                        ? "🍅"
                        : i.id === "cheese"
                          ? "🧀"
                          : "🥦"}
                  </span>
                  <p>{i.name}</p>
                  <h2>
                    {i.stock} <small>units</small>
                  </h2>
                  <label>Set current stock</label>
                  <div className="stock">
                    <input
                      id={"stock" + i.id}
                      type="number"
                      min="0"
                      defaultValue={i.stock}
                    />
                    <button
                      className="secondary"
                      onClick={() =>
                        stock(i, document.getElementById("stock" + i.id).value)
                      }
                    >
                      Save
                    </button>
                  </div>
                  {i.stock < 20 && (
                    <small className="low">Low stock · threshold 20</small>
                  )}
                </div>
              ))}
            </div>
            <h3 className="subhead">Incoming orders</h3>
            {orders.map((o) => (
              <article className="order" key={o._id || o.id}>
                <div className="orderhead">
                  <h3>
                    #{o.id} · {o.customerName}
                  </h3>
                  <select
                    value={o.status}
                    onChange={(e) => status(o, e.target.value)}
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <p>
                  {o.pizza.base} · {o.pizza.sauce} · {o.pizza.cheese}
                </p>
              </article>
            ))}
            <p className="fine">
              Starter limitation: inventory does not yet deduct ingredients
              automatically.
            </p>
          </section>
        )}
      </main>
      <footer>
        <b>
          🍕 Pizza<span className="red">Craft</span>
        </b>
        <span>Made with ♥ for pizza people</span>
        <span>DEMO APPLICATION</span>
      </footer>
    </div>
  );
}
