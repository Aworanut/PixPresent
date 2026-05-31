alter table events
  add column liveness_required boolean not null default false;
