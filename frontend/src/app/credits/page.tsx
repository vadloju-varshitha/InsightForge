'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import {
  CreditCard,
  Coins,
  History,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_insightforge';

export default function CreditsPage() {
  const { user, updateUserCredits, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<number | null>(null);

  const pricingTiers = [
    { id: 1, credits: 5, price: 500, label: 'Starter Pack', desc: 'Ideal for small retail research projects' },
    { id: 2, credits: 15, price: 1200, label: 'Expansion Pack', desc: 'Great for active commercial property analysis' },
    { id: 3, credits: 50, price: 3000, label: 'Enterprise Pack', desc: 'Designed for nationwide chain networks' },
  ];

  // 1. Fetch transaction history
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:5000/api/credits/history');
      return res.data;
    },
  });

  // Load Razorpay script on mount
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // 2. Buy credits trigger
  const buyCredits = async (tier: typeof pricingTiers[0]) => {
    setPaymentError(null);
    setPaymentSuccess(null);
    setActiveTier(tier.id);

    try {
      // Step A: Create order on backend
      const orderRes = await axios.post('http://localhost:5000/api/credits/order', {
        amount: tier.price,
        credits: tier.credits,
      });

      const { orderId, amount, currency, keyId } = orderRes.data;

      // Step B: Configure Razorpay Checkout pop-up
      const options = {
        key: keyId || RAZORPAY_KEY_ID,
        amount: amount,
        currency: currency,
        name: 'InsightForge SaaS',
        description: `Purchase ${tier.credits} Report Credits`,
        order_id: orderId,
        handler: async function (response: any) {
          // Callback on successful payment
          try {
            const verifyRes = await axios.post('http://localhost:5000/api/credits/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              credits: tier.credits,
            });

            setPaymentSuccess(`Successfully purchased ${tier.credits} credits! Your balance has been updated.`);
            updateUserCredits(verifyRes.data.credits);
            
            // Invalidate queries to refresh lists
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            await refreshUser();
          } catch (err: any) {
            setPaymentError(err.response?.data?.error || err.message || 'Payment signature verification failed.');
          } finally {
            setActiveTier(null);
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        theme: {
          color: '#1E3A8A', // Primary brand color
        },
        modal: {
          ondismiss: function () {
            setActiveTier(null);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      
      // Register error handler for payment failures (Requirement 7 & 8)
      rzp.on('payment.failed', function (resp: any) {
        const errorDetails = resp.error;
        console.error('[Razorpay Checkout Error]:', errorDetails);
        setPaymentError(`Payment Failed: ${errorDetails.description || 'Unknown error'} (Reason: ${errorDetails.reason || 'N/A'}, Code: ${errorDetails.code || 'N/A'})`);
        setActiveTier(null);
      });

      rzp.open();
    } catch (err: any) {
      console.error('[BuyCredits] Checkout initialization failed:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to initiate Razorpay checkout. Please try again.';
      setPaymentError(errorMsg);
      setActiveTier(null);
    }
  };

  return (
    <DashboardLayout>
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold font-display text-slate-900 dark:text-slate-50 tracking-tight">
          Credit Center
        </h1>
        <p className="text-sm font-semibold text-slate-500 mt-1">
          Purchase report generation credits and view your complete billing transactions history.
        </p>
      </div>

      {paymentSuccess && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
          <span>{paymentSuccess}</span>
        </div>
      )}

      {paymentError && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 text-xs font-semibold text-red-600 dark:text-red-400">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{paymentError}</span>
        </div>
      )}

      {/* Credit Balance readout card */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 border border-blue-950 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-blue-200 uppercase tracking-wide">Current Workspace Balance</p>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight font-display">
              {user?.credits !== undefined && user.credits >= 0 ? `${user.credits} Credits` : 'Account Suspended'}
            </h2>
            <span className="p-2 bg-blue-800/40 rounded-lg text-blue-200">
              <Coins size={24} />
            </span>
          </div>
          <p className="text-xs text-blue-300 font-semibold">Each location intelligence report consumes exactly 1 credit.</p>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-bold bg-blue-950/40 p-4 rounded-xl border border-blue-800/30">
          <div>
            <span className="block text-blue-300">Sandbox Mode</span>
            <span className="block text-slate-100 font-medium">Checkout runs under Razorpay Test credentials</span>
          </div>
        </div>
      </div>

      {/* Pricing packages grid */}
      <div className="space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <CreditCard size={18} className="text-blue-600" />
          Select Refill Package
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pricingTiers.map((tier) => {
            const isProcessing = activeTier === tier.id;
            return (
              <div
                key={tier.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-900 hover:shadow-md transition-all duration-300"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{tier.label}</span>
                    <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">+{tier.credits}</span>
                  </div>
                  <h4 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">
                    ₹{tier.price.toLocaleString()}
                  </h4>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">{tier.desc}</p>
                </div>

                <button
                  onClick={() => buyCredits(tier)}
                  disabled={isProcessing}
                  className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-md shadow-blue-500/10 text-xs transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Connecting Razorpay...
                    </>
                  ) : (
                    <>
                      Purchase Package
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction History library */}
      <div className="space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <History size={18} className="text-blue-600" />
          Transaction & Billing History
        </h3>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          {historyLoading ? (
            <div className="h-40 flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-600" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-xs font-semibold text-slate-400">
              No transactions logged in history yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5">Transaction ID</th>
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">Adjustment</th>
                    <th className="py-2.5">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-semibold text-slate-700 dark:text-slate-300">
                  {history.map((tx: any) => (
                    <tr key={tx.id}>
                      <td className="py-3 font-mono">{tx.transaction_id}</td>
                      <td className="py-3">{new Date(tx.timestamp).toLocaleString()}</td>
                      <td className={`py-3 font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount} credits
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                          tx.type === 'PURCHASE' 
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' 
                            : tx.type === 'REFUND'
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                            : 'bg-red-50 dark:bg-red-950/40 text-red-600'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </DashboardLayout>
  );
}
