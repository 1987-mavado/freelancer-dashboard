-- Stundentool: To-Do und Timer als gemeinsames Feld. Ein To-Do kann optional
-- ein Projekt/eine Rolle/eine geschätzte Zeit tragen; darüber lässt sich ein
-- Zeiteintrag starten, der per todo_id zurückverknüpft wird.
alter table todos add column if not exists geschaetzte_minuten integer not null default 0;
alter table todos add column if not exists projekt_id bigint references projekte(id) on delete set null;
alter table todos add column if not exists rolle text not null default '';

alter table zeiteintraege add column if not exists todo_id bigint references todos(id) on delete set null;
