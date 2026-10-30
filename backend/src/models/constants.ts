// @ts-nocheck
/**
 * Shared constants, enums and state-machine definitions for the commerce platform.
 *
 * Monetary values are stored as integer MINOR units (e.g. paise for INR, cents for USD).
 * Rounding rule: amounts are rounded to the nearest minor unit at creation and never
 * recomputed afterwards. Order price snapshots are immutable once created.
 */
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
export const CURRENCY_MINOR_UNITS = {
    INR: 100,
    USD: 100,
    EUR: 100,
    GBP: 100,
};
/**
 * Order status state machine.
 *
 * DRAFT → PENDING_PAYMENT → CONFIRMED → PROCESSING → FULFILLED
 * Other permitted: CANCELLED, EXPIRED, REFUND_PENDING
 *
 * Order status and payment status are independent. A successful payment does not
 * automatically advance fulfillment; admins manage fulfillment separately.
 */
export var OrderStatus;
(function (OrderStatus) {
    OrderStatus["DRAFT"] = "DRAFT";
    OrderStatus["PENDING_PAYMENT"] = "PENDING_PAYMENT";
    OrderStatus["CONFIRMED"] = "CONFIRMED";
    OrderStatus["PROCESSING"] = "PROCESSING";
    OrderStatus["FULFILLED"] = "FULFILLED";
    OrderStatus["CANCELLED"] = "CANCELLED";
    OrderStatus["EXPIRED"] = "EXPIRED";
    OrderStatus["REFUND_PENDING"] = "REFUND_PENDING";
})(OrderStatus || (OrderStatus = {}));
export const ORDER_STATUSES = [
    OrderStatus.DRAFT,
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.FULFILLED,
    OrderStatus.CANCELLED,
    OrderStatus.EXPIRED,
    OrderStatus.REFUND_PENDING,
];
export var OrderPaymentStatus;
(function (OrderPaymentStatus) {
    OrderPaymentStatus["UNPAID"] = "UNPAID";
    OrderPaymentStatus["PENDING"] = "PENDING";
    OrderPaymentStatus["PAID"] = "PAID";
    OrderPaymentStatus["FAILED"] = "FAILED";
    OrderPaymentStatus["REFUNDED"] = "REFUNDED";
    OrderPaymentStatus["PARTIALLY_REFUNDED"] = "PARTIALLY_REFUNDED";
    OrderPaymentStatus["REFUND_PENDING"] = "REFUND_PENDING";
})(OrderPaymentStatus || (OrderPaymentStatus = {}));
export const ORDER_PAYMENT_STATUSES = [
    OrderPaymentStatus.UNPAID,
    OrderPaymentStatus.PENDING,
    OrderPaymentStatus.PAID,
    OrderPaymentStatus.FAILED,
    OrderPaymentStatus.REFUNDED,
    OrderPaymentStatus.PARTIALLY_REFUNDED,
    OrderPaymentStatus.REFUND_PENDING,
];
export var FulfillmentStatus;
(function (FulfillmentStatus) {
    FulfillmentStatus["NOT_STARTED"] = "NOT_STARTED";
    FulfillmentStatus["PROCESSING"] = "PROCESSING";
    FulfillmentStatus["SHIPPED"] = "SHIPPED";
    FulfillmentStatus["DELIVERED"] = "DELIVERED";
    FulfillmentStatus["COMPLETED"] = "COMPLETED";
})(FulfillmentStatus || (FulfillmentStatus = {}));
export const FULFILLMENT_STATUSES = [
    FulfillmentStatus.NOT_STARTED,
    FulfillmentStatus.PROCESSING,
    FulfillmentStatus.SHIPPED,
    FulfillmentStatus.DELIVERED,
    FulfillmentStatus.COMPLETED,
];
/**
 * Payment attempt verification status.
 */
export var PaymentVerificationStatus;
(function (PaymentVerificationStatus) {
    PaymentVerificationStatus["UNVERIFIED"] = "UNVERIFIED";
    PaymentVerificationStatus["VERIFIED"] = "VERIFIED";
    PaymentVerificationStatus["VERIFICATION_FAILED"] = "VERIFICATION_FAILED";
})(PaymentVerificationStatus || (PaymentVerificationStatus = {}));
export var PaymentAttemptStatus;
(function (PaymentAttemptStatus) {
    PaymentAttemptStatus["CREATED"] = "CREATED";
    PaymentAttemptStatus["PENDING"] = "PENDING";
    PaymentAttemptStatus["SUCCESS"] = "SUCCESS";
    PaymentAttemptStatus["FAILED"] = "FAILED";
    PaymentAttemptStatus["CANCELLED"] = "CANCELLED";
    PaymentAttemptStatus["EXPIRED"] = "EXPIRED";
})(PaymentAttemptStatus || (PaymentAttemptStatus = {}));
export var RefundStatus;
(function (RefundStatus) {
    RefundStatus["PENDING"] = "PENDING";
    RefundStatus["SUCCEEDED"] = "SUCCEEDED";
    RefundStatus["FAILED"] = "FAILED";
})(RefundStatus || (RefundStatus = {}));
export var UserRole;
(function (UserRole) {
    UserRole["CUSTOMER"] = "CUSTOMER";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (UserRole = {}));
export const USER_ROLES = [UserRole.CUSTOMER, UserRole.ADMIN];
export var WebhookProcessingStatus;
(function (WebhookProcessingStatus) {
    WebhookProcessingStatus["RECEIVED"] = "RECEIVED";
    WebhookProcessingStatus["PROCESSED"] = "PROCESSED";
    WebhookProcessingStatus["FAILED"] = "FAILED";
    WebhookProcessingStatus["DUPLICATE"] = "DUPLICATE";
})(WebhookProcessingStatus || (WebhookProcessingStatus = {}));
export var ProductType;
(function (ProductType) {
    ProductType["PRODUCT"] = "PRODUCT";
    ProductType["SERVICE"] = "SERVICE";
})(ProductType || (ProductType = {}));
export const PRODUCT_TYPES = [ProductType.PRODUCT, ProductType.SERVICE];
/**
 * Transition rules: from status -> allowed to statuses.
 * Order status transitions only.
 */
export const ORDER_STATUS_TRANSITIONS = {
    [OrderStatus.DRAFT]: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED, OrderStatus.EXPIRED],
    [OrderStatus.PENDING_PAYMENT]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.EXPIRED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED, OrderStatus.REFUND_PENDING],
    [OrderStatus.PROCESSING]: [OrderStatus.FULFILLED, OrderStatus.CANCELLED, OrderStatus.REFUND_PENDING],
    [OrderStatus.FULFILLED]: [OrderStatus.REFUND_PENDING],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.EXPIRED]: [],
    [OrderStatus.REFUND_PENDING]: [OrderStatus.CANCELLED],
};
export function canTransitionOrder(from, to) {
    return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

