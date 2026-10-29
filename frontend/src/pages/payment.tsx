import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/ui/sonner';

declare global {
  interface Window {
    Cashfree: any;
  }
}

export function PaymentPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    amount: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'PENDING' | 'PAID' | 'FAILED'>('IDLE');
  const [orderId, setOrderId] = useState<string>('');

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Invalid email address';
      }
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Mobile number is required';
    } else {
      const phoneRegex = /^[6-9]\d{9}$/;
      const cleanPhone = formData.phone.replace(/\D/g, '');
      if (!phoneRegex.test(cleanPhone.slice(-10))) {
        newErrors.phone = 'Invalid Indian mobile number';
      }
    }
    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const amount = parseFloat(formData.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        newErrors.amount = 'Amount must be greater than 0';
      } else {
        const amountStr = formData.amount;
        if (amountStr.includes('.')) {
          const decimals = amountStr.split('.')[1];
          if (decimals && decimals.length > 2) {
            newErrors.amount = 'Amount can have at most 2 decimal places';
          }
        }
        if (amount < 1 || amount > 100000) {
          newErrors.amount = 'Amount must be between 1 and 100000 INR';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setPaymentStatus('IDLE');

    try {
      const response = await api.post('/payments/create-order', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        amount: parseFloat(formData.amount),
        description: formData.description || undefined,
      });

      const { orderId: newOrderId, paymentSessionId } = response.data;
      setOrderId(newOrderId);

      // Load Cashfree SDK if not already loaded
      if (!window.Cashfree) {
        const script = document.createElement('script');
        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      const cashfree = window.Cashfree({
        mode: 'sandbox',
      });

      const checkoutOptions = {
        paymentSessionId,
        returnUrl: `${window.location.origin}/?orderId=${newOrderId}`,
      };

      cashfree.checkout(checkoutOptions).then(async () => {
        // After checkout, verify payment
        await verifyPayment(newOrderId);
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create payment order');
      setLoading(false);
    }
  };

  const verifyPayment = async (id: string) => {
    setPaymentStatus('PENDING');
    try {
      const response = await api.get(`/payments/verify/${id}`);
      setPaymentStatus(response.data.status);
    } catch (error) {
      setPaymentStatus('FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Card className="p-6 shadow-lg">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Cashfree Payment</h1>
            <p className="text-gray-600">Enter your details to make a payment</p>
          </div>

          {paymentStatus === 'PAID' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <h2 className="text-lg font-semibold text-green-900 mb-1">Payment Successful</h2>
              <p className="text-green-700 text-sm">Your payment has been verified successfully.</p>
            </div>
          )}

          {paymentStatus === 'FAILED' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
              <XCircle className="h-12 w-12 text-red-600 mx-auto mb-2" />
              <h2 className="text-lg font-semibold text-red-900 mb-1">Payment Failed</h2>
              <p className="text-red-700 text-sm">Payment could not be completed or verified.</p>
            </div>
          )}

          {paymentStatus === 'PENDING' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
              <Clock className="h-12 w-12 text-yellow-600 mx-auto mb-2 animate-spin" />
              <h2 className="text-lg font-semibold text-yellow-900 mb-1">Verifying Payment</h2>
              <p className="text-yellow-700 text-sm">Please wait while we verify your payment...</p>
            </div>
          )}

          {paymentStatus === 'IDLE' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <Label htmlFor="phone">Indian Mobile Number *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="10-digit mobile number"
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>

              <div>
                <Label htmlFor="amount">Amount in INR *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Enter amount"
                />
                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
              </div>

              <div>
                <Label htmlFor="description">Payment Description (Optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Product purchase"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Pay Now'
                )}
              </Button>
            </form>
          )}

          {(paymentStatus === 'PAID' || paymentStatus === 'FAILED') && (
            <Button
              onClick={() => {
                setPaymentStatus('IDLE');
                setFormData({ name: '', email: '', phone: '', amount: '', description: '' });
                setErrors({});
                setOrderId('');
              }}
              className="w-full"
              variant="outline"
            >
              Make Another Payment
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
