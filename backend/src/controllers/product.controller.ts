// @ts-nocheck
import { Product } from '../models.js';
import { createAuditLog } from '../utils/audit-log.js';
export async function listProducts(req, res) {
    const { page = 1, limit = 20, search, category, type, isActive, minPrice, maxPrice, } = req.query;
    const filter = {};
    if (search) {
        filter.$text = { $search: search };
    }
    if (category)
        filter.category = category;
    if (type)
        filter.type = type;
    if (isActive !== undefined)
        filter.isActive = isActive === 'true';
    if (minPrice !== undefined || maxPrice !== undefined) {
        const priceFilter = {};
        if (minPrice !== undefined)
            priceFilter.$gte = Number(minPrice);
        if (maxPrice !== undefined)
            priceFilter.$lte = Number(maxPrice);
        filter.priceMinor = priceFilter;
    }
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const [items, total] = await Promise.all([
        Product.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Product.countDocuments(filter),
    ]);
    res.json({
        data: items,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
}
export async function getProduct(req, res) {
    const { id } = req.params;
    const product = await Product.findById(id).lean();
    if (!product) {
        res.status(404).json({ error: 'Not found', message: 'Product not found' });
        return;
    }
    res.json({ data: product });
}
export async function createProduct(req, res) {
    const product = await Product.create(req.body);
    await createAuditLog({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: 'product.created',
        targetType: 'product',
        targetId: product._id.toString(),
        metadata: { name: product.name },
    });
    res.status(201).json({ data: product });
}
export async function updateProduct(req, res) {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!product) {
        res.status(404).json({ error: 'Not found', message: 'Product not found' });
        return;
    }
    await createAuditLog({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: 'product.updated',
        targetType: 'product',
        targetId: product._id.toString(),
        metadata: { name: product.name },
    });
    res.json({ data: product });
}
export async function deactivateProduct(req, res) {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!product) {
        res.status(404).json({ error: 'Not found', message: 'Product not found' });
        return;
    }
    await createAuditLog({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: 'product.deactivated',
        targetType: 'product',
        targetId: product._id.toString(),
    });
    res.json({ data: product });
}
export async function activateProduct(req, res) {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, { isActive: true }, { new: true });
    if (!product) {
        res.status(404).json({ error: 'Not found', message: 'Product not found' });
        return;
    }
    res.json({ data: product });
}

