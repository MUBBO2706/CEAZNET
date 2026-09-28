```sql
-- Dairy Items (e.g., Milk, Bread)
create table dairy_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  default_price numeric,
  unit text, -- 'liter', 'kg', 'packet'
  default_quantity numeric,
  icon text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Dairy Entries (Daily logs)
create table dairy_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  item_id uuid references dairy_items(id) on delete set null,
  quantity numeric not null,
  price_per_unit numeric not null,
  total_price numeric not null,
  entry_date date not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Dairy Payments (Payments made to the vendor)
create table dairy_payments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  item_id uuid references dairy_items(id) on delete set null,
  amount numeric not null,
  payment_date date not null,
  method text, -- 'cash', 'upi', etc.
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table dairy_items enable row level security;
create policy "Users can view their own dairy items" on dairy_items for select using (auth.uid() = user_id);
create policy "Users can insert their own dairy items" on dairy_items for insert with check (auth.uid() = user_id);
create policy "Users can update their own dairy items" on dairy_items for update using (auth.uid() = user_id);
create policy "Users can delete their own dairy items" on dairy_items for delete using (auth.uid() = user_id);

alter table dairy_entries enable row level security;
create policy "Users can view their own dairy entries" on dairy_entries for select using (auth.uid() = user_id);
create policy "Users can insert their own dairy entries" on dairy_entries for insert with check (auth.uid() = user_id);
create policy "Users can update their own dairy entries" on dairy_entries for update using (auth.uid() = user_id);
create policy "Users can delete their own dairy entries" on dairy_entries for delete using (auth.uid() = user_id);

alter table dairy_payments enable row level security;
create policy "Users can view their own dairy payments" on dairy_payments for select using (auth.uid() = user_id);
create policy "Users can insert their own dairy payments" on dairy_payments for insert with check (auth.uid() = user_id);
create policy "Users can update their own dairy payments" on dairy_payments for update using (auth.uid() = user_id);
create policy "Users can delete their own dairy payments" on dairy_payments for delete using (auth.uid() = user_id);
```
