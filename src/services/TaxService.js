import { TaxZone, TaxClass, TaxRate } from '../models/Tax.js';

class TaxService {
  /**
   * Calculate tax for an order
   */
  async calculateTax(orderItems, shippingAddress, subtotal) {
    if (!shippingAddress) {
      return { taxAmount: 0, taxBreakdown: [], taxRate: 0 };
    }

    // Find applicable tax zone
    const zone = await this.findTaxZone(shippingAddress);
    
    if (!zone) {
      return { taxAmount: 0, taxBreakdown: [], taxRate: 0 };
    }

    // Get tax rates for the zone
    const taxRates = await TaxRate.find({
      zone: zone._id,
      isActive: true,
      $or: [
        { validFrom: { $exists: false } },
        { validFrom: { $lte: new Date() } }
      ],
      $or: [
        { validUntil: { $exists: false } },
        { validUntil: { $gte: new Date() } }
      ]
    }).sort({ priority: 1 });

    if (taxRates.length === 0) {
      return { taxAmount: 0, taxBreakdown: [], taxRate: 0 };
    }

    // Calculate tax for each item
    const taxBreakdown = [];
    let totalTaxAmount = 0;
    let cumulativeTaxableAmount = subtotal;

    for (const rate of taxRates) {
      let taxableAmount = subtotal;

      // Apply thresholds
      if (rate.threshold?.minAmount) {
        taxableAmount = Math.max(0, taxableAmount - rate.threshold.minAmount);
      }
      if (rate.threshold?.maxAmount) {
        taxableAmount = Math.min(taxableAmount, rate.threshold.maxAmount);
      }

      // Calculate tax
      let taxAmount = (taxableAmount * rate.rate) / 100;

      // For compound taxes
      if (rate.isCompound) {
        taxAmount = ((cumulativeTaxableAmount + totalTaxAmount) * rate.rate) / 100;
      }

      totalTaxAmount += taxAmount;
      cumulativeTaxableAmount = taxableAmount;

      taxBreakdown.push({
        name: rate.name,
        rate: rate.rate,
        taxId: rate.taxId,
        amount: Math.round(taxAmount * 100) / 100
      });
    }

    return {
      taxAmount: Math.round(totalTaxAmount * 100) / 100,
      taxBreakdown,
      taxRate: taxBreakdown.length > 0 
        ? taxBreakdown.reduce((sum, t) => sum + t.rate, 0) 
        : 0,
      zone: zone.name
    };
  }

  /**
   * Find applicable tax zone for an address
   */
  async findTaxZone(address) {
    const zones = await TaxZone.find({ isActive: true });

    for (const zone of zones) {
      if (this.addressMatchesZone(address, zone)) {
        return zone;
      }
    }

    return null;
  }

  /**
   * Check if address matches a tax zone
   */
  addressMatchesZone(address, zone) {
    // Check country
    if (zone.countries?.length > 0) {
      if (!zone.countries.includes(address.country)) {
        return false;
      }
    }

    // Check state
    if (zone.states?.length > 0) {
      if (!zone.states.includes(address.state)) {
        return false;
      }
    }

    // Check city
    if (zone.cities?.length > 0) {
      if (!zone.cities.includes(address.city)) {
        return false;
      }
    }

    // Check postal codes
    if (zone.postalCodes?.length > 0) {
      const postalCode = address.zipCode;
      const matches = zone.postalCodes.some(range => {
        if (range.start && range.end) {
          return postalCode >= range.start && postalCode <= range.end;
        }
        return postalCode === range.start;
      });
      if (!matches) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get tax class for product
   */
  async getTaxClass(taxClassName) {
    return await TaxClass.findOne({ 
      name: taxClassName || 'standard', 
      isActive: true 
    });
  }

  /**
   * Calculate tax for single product
   */
  async calculateProductTax(product, shippingAddress) {
    if (product.taxExempt) {
      return { taxAmount: 0, taxBreakdown: [] };
    }

    const taxClass = await this.getTaxClass(product.taxClass);
    const zone = await this.findTaxZone(shippingAddress);

    if (!zone || !taxClass) {
      return { taxAmount: 0, taxBreakdown: [] };
    }

    const rate = await TaxRate.findOne({
      zone: zone._id,
      taxClass: taxClass._id,
      isActive: true
    });

    if (!rate) {
      return { taxAmount: 0, taxBreakdown: [] };
    }

    const taxAmount = (product.price * rate.rate) / 100;

    return {
      taxAmount: Math.round(taxAmount * 100) / 100,
      taxRate: rate.rate,
      taxBreakdown: [{
        name: rate.name,
        rate: rate.rate,
        amount: Math.round(taxAmount * 100) / 100
      }]
    };
  }

  /**
   * Get inclusive tax price (if prices include tax)
   */
  async getInclusiveTaxPrice(product, shippingAddress) {
    const { taxAmount, taxRate } = await this.calculateProductTax(product, shippingAddress);
    
    return {
      priceExcludingTax: product.price - taxAmount,
      priceIncludingTax: product.price,
      taxAmount,
      taxRate
    };
  }

  /**
   * Get all tax rates
   */
  async getAllTaxRates() {
    return await TaxRate.find({ isActive: true })
      .populate('zone')
      .populate('taxClass')
      .sort({ 'zone.name': 1, priority: 1 });
  }

  /**
   * Create or update tax rate
   */
  async upsertTaxRate(rateData) {
    const { zone, taxClass, name } = rateData;
    
    let rate = await TaxRate.findOne({ zone, taxClass, name });
    
    if (rate) {
      Object.assign(rate, rateData);
      await rate.save();
    } else {
      rate = await TaxRate.create(rateData);
    }

    return rate;
  }
}

export default new TaxService();
