"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { cartApi, parentsApi, paymentsApi, ApiError, type CartResponse, type ParentLink } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PendingPaymentConfirm } from "@/components/payments/pending-payment-confirm";
import { formatKES } from "@schoolmart/shared";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/wallet", label: "Wallet" },
  { href: "/parent/activities", label: "Funkies" },
  { href: "/parent/settings", label: "Settings" },
];

type PayMethod = "WALLET" | "MPESA" | "CARD" | "BANK";

export default function CartPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [children, setChildren] = useState<ParentLink[]>([]);
  const [studentId, setStudentId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>("WALLET");
  const [phone, setPhone] = useState("");
  const [pendingPayment, setPendingPayment] = useState<{ providerRef: string; hint: string } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const load = () => {
    cartApi.get().then(setCart).catch(() => setCart(null));
    parentsApi.children().then((res) => {
      const active = res.children.filter((c) => c.status === "ACTIVE");
      setChildren(active);
      if (!studentId && active[0]) setStudentId(active[0].student.id);
    }).catch(() => {});
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const selected = children.find((c) => c.student.id === studentId);
  const schoolId = selected?.student.school.id;

  const handleCheckout = async () => {
    if (!studentId || !schoolId) {
      setError("Select a child for this order");
      return;
    }
    if (paymentMethod === "MPESA" && !phone.trim()) {
      setError("Enter an M-PESA phone number");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    setPendingPayment(null);
    try {
      const result = await cartApi.checkout({
        studentId,
        schoolId,
        paymentMethod,
        phone: phone || undefined,
      });
      if (result.status === "PAID" && result.order) {
        setMessage(`Paid · Order ${result.order.orderNumber}`);
        load();
      } else if (result.status === "PENDING_PAYMENT" && result.payment?.providerRef) {
        setPendingPayment({
          providerRef: result.payment.providerRef,
          hint: result.instructions ?? "Confirm payment to complete the order.",
        });
        setMessage(`Awaiting ${paymentMethod} payment for order ${result.order?.orderNumber ?? ""}`);
      } else {
        setMessage(result.message ?? "Checkout needs your approval on the Wallet page");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!pendingPayment) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await paymentsApi.completeMock({
        providerRef: pendingPayment.providerRef,
        status: "SUCCEEDED",
      });
      setPendingPayment(null);
      if (result.order) {
        setMessage(`Paid · Order ${result.order.orderNumber}`);
      } else {
        setMessage("Payment confirmed");
      }
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not confirm payment");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-ink">Cart</h2>
          <p className="text-brand-muted">
            Pay from the child wallet, or charge the order directly via M-PESA, card, or bank.
          </p>
        </div>
        <Button href="/parent/shop" variant="secondary">Continue shopping</Button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {!cart || cart.items.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <Image src="/graphics/empty-shop.png" alt="" width={160} height={160} className="mb-4 rounded-2xl" />
          <p className="mb-4 text-brand-muted">Your cart is empty.</p>
          <Button href="/parent/shop">Browse shop</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {cart.items.map((item) => (
            <Card key={item.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-brand-ink">{item.product.name}</p>
                <p className="text-sm text-brand-muted">{item.product.vendor.name}</p>
                <p className="text-sm text-brand-muted">
                  {formatKES(item.product.priceMinor)} × {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-bold text-brand-teal">{formatKES(item.lineTotalMinor)}</p>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const updated = await cartApi.updateItem(item.id, item.quantity - 1);
                    setCart(updated);
                  }}
                >
                  −
                </Button>
                <span className="w-6 text-center font-medium">{item.quantity}</span>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const updated = await cartApi.updateItem(item.id, item.quantity + 1);
                    setCart(updated);
                  }}
                >
                  +
                </Button>
              </div>
            </Card>
          ))}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Subtotal</p>
              <p className="text-xl font-bold text-brand-teal">{formatKES(cart.subtotalMinor)}</p>
            </div>
            {children.length > 0 ? (
              <Select
                label="Child / school for this order"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                options={children.map((c) => ({
                  value: c.student.id,
                  label: `${c.student.firstName} ${c.student.lastName} (${c.student.school.name})`,
                }))}
              />
            ) : (
              <p className="text-sm text-brand-muted">Link and get school approval for a child before checkout.</p>
            )}
            <Select
              label="Pay with"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PayMethod)}
              options={[
                { value: "WALLET", label: "Child wallet" },
                { value: "MPESA", label: "M-PESA (direct)" },
                { value: "CARD", label: "Card (direct)" },
                { value: "BANK", label: "Bank (direct)" },
              ]}
            />
            {paymentMethod === "MPESA" && (
              <Input
                label="M-PESA phone"
                type="tel"
                placeholder="0712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            )}
            <Button type="button" disabled={busy || !studentId} onClick={handleCheckout}>
              {busy ? "Processing…" : paymentMethod === "WALLET" ? "Checkout with wallet" : "Pay now"}
            </Button>
            {pendingPayment && (
              <PendingPaymentConfirm
                hint={pendingPayment.hint}
                busy={busy}
                onConfirm={handleConfirmPayment}
              />
            )}
          </Card>
        </div>
      )}
    </PortalLayout>
  );
}
