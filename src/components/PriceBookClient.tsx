"use client";

import React, { useState, useTransition } from 'react';
import { Plus, Search, Tag, Trash2, X, Sparkles } from 'lucide-react';
import { createService, deleteService, seedDefaultServices } from '@/app/actions/services';
import { currencySymbol, formatMoney } from '@/lib/money';

type Service = {
  id: string;
  name: string;
  price: number;
};

export default function PriceBookClient({ initialServices, currency }: { initialServices: Service[]; currency?: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredServices = initialServices.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    const fd = new FormData();
    fd.append('name', name);
    fd.append('price', price);

    startTransition(async () => {
      setError(null);
      const res = await createService(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setName('');
      setPrice('');
      setIsModalOpen(false);
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to remove this service from the price book?")) {
      startTransition(async () => {
        setError(null);
        const res = await deleteService(id);
        if (res.error) setError(res.error);
      });
    }
  };

  const handleSeed = () => {
    startTransition(async () => {
      setError(null);
      const res = await seedDefaultServices();
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Price Book</h1>
          <p className="text-zinc-500 mt-1">Manage your standard service offerings and pricing</p>
        </div>

        <div className="flex items-center gap-2">
          {initialServices.length === 0 && (
            <button 
              onClick={handleSeed}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm"
            >
              <Sparkles size={14} /> Add Standard Services
            </button>
          )}

          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#6329d4] hover:bg-[#5221b3] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus size={16} /> Add Service
          </button>
        </div>
      </div>

      {/* Main Container */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="font-bold">Couldn't save:</span>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-rose-400 hover:text-rose-600 font-bold"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 p-6">
        
        {/* Search Bar */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input 
            type="text" 
            placeholder="Search price book by name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6329d4]/20 focus:border-[#6329d4]"
          />
        </div>

        {/* Services Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map(service => (
            <div key={service.id} className="p-5 border border-zinc-200 rounded-2xl hover:border-[#6329d4]/30 hover:shadow-md transition-all group relative bg-white">
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#f5f1fa] text-[#6329d4] flex items-center justify-center">
                  <Tag size={18} />
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-zinc-900">{formatMoney(service.price, currency)}</span>
                  <button 
                    onClick={() => handleDelete(service.id)}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-all"
                    title="Delete service"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-base text-zinc-900 mb-1">{service.name}</h3>
              <p className="text-xs text-zinc-500">Standard flat rate service</p>
            </div>
          ))}

          {filteredServices.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-200 rounded-2xl text-center">
              <Tag size={40} className="text-zinc-300 mb-3" />
              {initialServices.length === 0 ? (
                <>
                  <h3 className="text-base font-bold text-zinc-900 mb-1">No services yet</h3>
                  <p className="text-xs text-zinc-500 mb-4 max-w-xs">Add your service list to streamline quotes and invoicing.</p>

                  <button
                    onClick={handleSeed}
                    disabled={isPending}
                    className="bg-[#6329d4] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#5221b3] transition-colors flex items-center gap-2"
                  >
                    <Sparkles size={14} /> Populate 6 Standard Services
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-base font-bold text-zinc-900 mb-1">No services match your search</h3>
                  <p className="text-xs text-zinc-500 mb-4 max-w-xs">
                    Try a different search term — your {initialServices.length} saved service{initialServices.length === 1 ? ' is' : 's are'} still in the price book.
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-zinc-700 transition-colors"
                  >
                    Clear search
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Service Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-700"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-zinc-900 mb-1">Add New Service</h2>
            <p className="text-xs text-zinc-500 mb-6">Add a flat rate service item to your price book.</p>

            <form onSubmit={handleAddService} className="space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Service Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Split AC Jet Wash"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6329d4]/20 focus:border-[#6329d4]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Flat Rate Price ({currencySymbol(currency)})</label>
                <input 
                  type="number" 
                  required
                  placeholder="e.g. 1500"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6329d4]/20 focus:border-[#6329d4]"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full bg-[#6329d4] hover:bg-[#5221b3] text-white py-3.5 rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save to Price Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
