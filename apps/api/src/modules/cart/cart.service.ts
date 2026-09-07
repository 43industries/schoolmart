import { prisma, ProductStatus, VendorStatus } from "@schoolmart/db";
import type { AddCartItemInput, UpdateCartItemInput } from "@schoolmart/shared";
import { AppError, NotFoundError } from "../../lib/errors.js";

async function getOrCreateCart(parentUserId: string, schoolId?: string, studentId?: string) {
  let cart = await prisma.cart.findFirst({
    where: { parentUserId },
    orderBy: { updatedAt: "desc" },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { parentUserId, schoolId, studentId },
    });
  } else if (schoolId || studentId) {
    cart = await prisma.cart.update({
      where: { id: cart.id },
      data: {
        ...(schoolId ? { schoolId } : {}),
        ...(studentId ? { studentId } : {}),
      },
    });
  }

  return cart;
}

export async function getCart(parentUserId: string) {
  const cart = await prisma.cart.findFirst({
    where: { parentUserId },
    include: {
      items: {
        include: {
          product: {
            include: {
              vendor: { select: { id: true, name: true } },
              inventory: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!cart) {
    return { id: null, items: [], subtotalMinor: 0, itemCount: 0 };
  }

  const subtotalMinor = cart.items.reduce(
    (sum, item) => sum + item.product.priceMinor * item.quantity,
    0,
  );

  return {
    id: cart.id,
    schoolId: cart.schoolId,
    studentId: cart.studentId,
    items: cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      product: {
        id: item.product.id,
        name: item.product.name,
        priceMinor: item.product.priceMinor,
        vendor: item.product.vendor,
        availableQty: item.product.inventory?.availableQty ?? 0,
      },
      lineTotalMinor: item.product.priceMinor * item.quantity,
    })),
    subtotalMinor,
    itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

export async function addCartItem(parentUserId: string, input: AddCartItemInput) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: { inventory: true, vendor: true },
  });
  if (!product || product.status !== ProductStatus.ACTIVE) {
    throw new NotFoundError("Product not available");
  }
  if (product.vendor.status !== VendorStatus.APPROVED) {
    throw new AppError(400, "Vendor is not approved");
  }

  if (input.schoolId) {
    const approved = await prisma.schoolProduct.findFirst({
      where: { schoolId: input.schoolId, productId: input.productId, approved: true },
    });
    if (!approved) throw new AppError(400, "Product not available at this school");
  }

  const available = product.inventory?.availableQty ?? 0;
  if (available < input.quantity) {
    throw new AppError(400, "Insufficient stock");
  }

  const cart = await getOrCreateCart(parentUserId, input.schoolId, input.studentId);

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: input.productId } },
  });

  const newQty = (existing?.quantity ?? 0) + input.quantity;
  if (available < newQty) throw new AppError(400, "Insufficient stock");

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId: input.productId } },
    create: { cartId: cart.id, productId: input.productId, quantity: input.quantity },
    update: { quantity: newQty },
  });

  return getCart(parentUserId);
}

export async function updateCartItem(parentUserId: string, itemId: string, input: UpdateCartItemInput) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { parentUserId } },
    include: { product: { include: { inventory: true } } },
  });
  if (!item) throw new NotFoundError("Cart item not found");

  if (input.quantity === 0) {
    await prisma.cartItem.delete({ where: { id: itemId } });
  } else {
    const available = item.product.inventory?.availableQty ?? 0;
    if (available < input.quantity) throw new AppError(400, "Insufficient stock");
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: input.quantity } });
  }

  return getCart(parentUserId);
}

export async function clearCart(parentUserId: string) {
  const cart = await prisma.cart.findFirst({ where: { parentUserId } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
  return getCart(parentUserId);
}
