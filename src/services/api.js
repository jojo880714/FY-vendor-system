const GAS_URL = import.meta.env.VITE_GAS_URL;

async function callGAS(params) {
  const url = new URL(GAS_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const res = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });
  
  const text = await res.text();
  return JSON.parse(text);
}

export const api = {
  getVendorsForBoard: () => callGAS({ action: 'getVendorsForBoard' }),
  getVendorDetail: (vendorId) => callGAS({ action: 'getVendorDetail', vendorId }),
};
