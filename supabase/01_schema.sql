-- 가게온 인쇄 견적 매칭: 테이블
-- Supabase SQL Editor에서 01 → 02 → 03 → 04 순서로 실행한다. 설계: docs/PRINT_PLATFORM.md 2.6

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9]{4,20}$'),
  role text not null check (role in ('owner', 'printer')),
  display_name text not null check (char_length(display_name) between 1 and 24),
  created_at timestamptz not null default now()
);

create table public.print_shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  region_sido text,
  region_sigungu text,
  address_detail text,              -- 수락된 의뢰 상대에게만 공개 (함수 shop_address)
  items text[] not null default '{}',
  intro text check (char_length(intro) <= 300),
  min_quantity int check (min_quantity > 0),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  industry text,
  data jsonb not null default '{}',
  character_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.print_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  title text not null check (char_length(title) between 1 and 40),
  item text not null check (item in ('sticker', 'wrapping', 'shopping_bag', 'other')),
  item_other text check (char_length(item_other) <= 30),
  quantity int not null check (quantity between 1 and 100000),
  width numeric(6,1) not null check (width between 1 and 2000),
  height numeric(6,1) not null check (height between 1 and 2000),
  unit text not null check (unit in ('mm', 'cm')),
  material text not null check (char_length(material) between 1 and 30),
  finishing text[] not null default '{}',
  due_date date not null,
  quote_deadline timestamptz not null,
  region_sido text not null,
  region_sigungu text not null,
  note text check (char_length(note) <= 500),
  design_path text not null,        -- request-files/{owner_id}/{request_id}/original.*
  preview_path text not null,       -- request-previews/{owner_id}/{request_id}.webp
  status text not null default 'open'
    check (status in ('open', 'accepted', 'in_progress', 'delivered', 'completed', 'canceled', 'expired')),
  accepted_quotation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (item <> 'other' or item_other is not null),
  check (quote_deadline::date <= due_date)
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.print_requests(id) on delete cascade,
  shop_id uuid not null references public.print_shops(id) on delete cascade,
  unit_price int not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  total_price int not null check (total_price >= 0),
  shipping_fee int not null default 0 check (shipping_fee >= 0),
  production_days int not null check (production_days between 1 and 90),
  delivery_date date not null,
  note text check (char_length(note) <= 500),
  status text not null default 'submitted' check (status in ('submitted', 'withdrawn', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, shop_id)
);
-- 요청당 수락된 견적은 하나뿐. 동시 수락의 마지막 방어선
create unique index one_accepted_per_request on public.quotations (request_id) where status = 'accepted';

alter table public.print_requests
  add constraint accepted_quotation_fk foreign key (accepted_quotation_id) references public.quotations(id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique not null references public.print_requests(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  printer_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,          -- 재시도 때 중복 저장 방지
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (conversation_id, client_id)
);
create index messages_conv_id on public.messages (conversation_id, id desc);

create table public.conversation_reads (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  last_read_id bigint not null default 0,
  primary key (conversation_id, user_id)
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('quote_received', 'quote_accepted', 'quote_declined', 'message', 'status_changed')),
  ref_id uuid,
  title text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, id desc);

create table public.ai_usage (
  user_id uuid references public.profiles(id) on delete cascade,
  day date not null default current_date,
  kind text not null check (kind in ('image', 'brand')),
  used int not null default 0,
  primary key (user_id, day, kind)
);
