import mongoose from 'mongoose';
import ReturnRequest from '../models/Return.js';

describe('ReturnRequest model', () => {
  it('generates a return number automatically when creating a return request', async () => {
    const returnRequest = await ReturnRequest.create({
      order: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      returnReason: 'damaged',
      items: [{ product: new mongoose.Types.ObjectId(), quantity: 1 }]
    });

    expect(returnRequest.returnNumber).toMatch(/^RET-\d+-\d{5}$/);
  });
});
