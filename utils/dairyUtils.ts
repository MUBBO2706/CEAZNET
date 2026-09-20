import { DairyEntry, DairyPayment } from '../types';

export interface EntryPaymentStatus extends DairyEntry {
    paidAmount: number;
    isFullyPaid: boolean;
}

export const allocatePayments = (entries: DairyEntry[], payments: DairyPayment[]): EntryPaymentStatus[] => {
    // Sort entries chronologically
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let remainingPayment = payments.reduce((sum, p) => sum + p.amount, 0);
    
    // First pass: allocate to explicitly paid entries
    const explicitlyPaidEntries = sortedEntries.filter(e => e.isPaid);
    const implicitlyPaidEntries = sortedEntries.filter(e => !e.isPaid);
    
    const result: EntryPaymentStatus[] = [];
    
    for (const entry of explicitlyPaidEntries) {
        const amountToPay = Math.min(entry.totalPrice, remainingPayment);
        remainingPayment -= amountToPay;
        result.push({
            ...entry,
            paidAmount: amountToPay,
            isFullyPaid: amountToPay === entry.totalPrice
        });
    }
    
    // Second pass: allocate remaining payment to implicitly paid entries chronologically
    for (const entry of implicitlyPaidEntries) {
        const amountToPay = Math.min(entry.totalPrice, remainingPayment);
        remainingPayment -= amountToPay;
        result.push({
            ...entry,
            paidAmount: amountToPay,
            isFullyPaid: amountToPay === entry.totalPrice
        });
    }
    
    // Restore original chronological order
    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};
