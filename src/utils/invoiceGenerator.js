import PDFDocument from 'pdfkit';

export const generateInvoicePDF = (order, stream) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  doc.pipe(stream);

  // 1. Header Section
  doc.fillColor('#1a1a1a')
     .fontSize(20)
     .text('eCommerce Store Invoice', 50, 45, { align: 'left' });
  
  doc.fontSize(10)
     .text(`Invoice Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, 70, { align: 'left' })
     .text(`Order ID: ${order._id}`, 50, 85, { align: 'left' })
     .text(`Payment Method: ${order.paymentMethod}`, 50, 100, { align: 'left' })
     .text(`Status: ${order.orderStatus}`, 50, 115, { align: 'left' });

  // 2. Billing / Shipping Details
  doc.fontSize(12)
     .text('Shipping Address:', 50, 145, { underline: true });
  
  const { shippingAddress, user } = order;
  doc.fontSize(10)
     .text(user?.name || 'Customer Name', 50, 165)
     .text(shippingAddress.street, 50, 180)
     .text(`${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.zipCode}`, 50, 195)
     .text(shippingAddress.country, 50, 210);

  // Divider Line
  doc.moveTo(50, 235).lineTo(550, 235).stroke('#cccccc');

  // 3. Table Header
  let y = 250;
  doc.fontSize(11)
     .text('Item Description', 50, y, { bold: true })
     .text('Qty', 350, y, { width: 40, align: 'right' })
     .text('Unit Price', 410, y, { width: 60, align: 'right' })
     .text('Total', 490, y, { width: 60, align: 'right' });

  doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke('#e0e0e0');
  y += 25;

  // 4. Line Items
  order.orderItems.forEach(item => {
    doc.fontSize(10)
       .text(item.title, 50, y, { width: 280, height: 15, ellipsis: true })
       .text(item.quantity.toString(), 350, y, { width: 40, align: 'right' })
       .text(`$${item.price.toFixed(2)}`, 410, y, { width: 60, align: 'right' })
       .text(`$${(item.quantity * item.price).toFixed(2)}`, 490, y, { width: 60, align: 'right' });
    y += 20;
  });

  doc.moveTo(50, y + 5).lineTo(550, y + 5).stroke('#e0e0e0');
  y += 15;

  // 5. Calculations Summary
  const printSummaryRow = (label, value) => {
    doc.fontSize(10)
       .text(label, 350, y, { width: 120, align: 'right' })
       .text(value, 490, y, { width: 60, align: 'right' });
    y += 18;
  };

  const subtotal = order.orderItems.reduce((acc, item) => acc + item.quantity * item.price, 0);
  printSummaryRow('Subtotal:', `$${subtotal.toFixed(2)}`);
  printSummaryRow('Tax (15%):', `$${order.taxPrice.toFixed(2)}`);
  printSummaryRow('Shipping:', `$${order.shippingPrice.toFixed(2)}`);
  if (order.discountPrice > 0) {
    printSummaryRow('Coupon Discount:', `-$${order.discountPrice.toFixed(2)}`);
  }

  doc.moveTo(350, y).lineTo(550, y).stroke('#1a1a1a');
  y += 10;

  doc.fontSize(12)
     .fillColor('#1a1a1a')
     .text('Grand Total:', 350, y, { width: 120, align: 'right', bold: true })
     .text(`$${order.totalPrice.toFixed(2)}`, 490, y, { width: 60, align: 'right', bold: true });

  // 6. Footer message
  doc.fontSize(9)
     .fillColor('#777777')
     .text('Thank you for shopping with us! If you have any questions, please contact support.', 50, 750, { align: 'center' });

  doc.end();
};
