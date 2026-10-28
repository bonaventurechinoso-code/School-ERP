"use client";

import React from "react";
import FeePaymentCheckout from "@/app/portal/student/components/FeePaymentCheckout";
import { InvoiceItem, StudentProfileData } from "@/app/portal/student/types";

export interface StudentFeePaymentModalProps {
  invoice: InvoiceItem;
  student?: StudentProfileData;
  subdomain: string;
  onClose: () => void;
  onPaymentSuccess?: (invoiceId: string, amountPaid: number, reference: string) => void;
}

/**
 * StudentFeePaymentModal
 * Renders the tenant-governed student fee settlement modal with Direct Bank / Mobile Transfer
 * and proof of payment submission (depositor_name, transfer_reference, proof_of_payment_url).
 */
export default function StudentFeePaymentModal(props: StudentFeePaymentModalProps) {
  return <FeePaymentCheckout {...props} />;
}

