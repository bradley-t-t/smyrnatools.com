CREATE TABLE public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.operators(employee_id),
  team VARCHAR(1) NOT NULL CHECK (team IN ('A', 'B')),
  CONSTRAINT teams_employee_id_key UNIQUE (employee_id)
) TABLESPACE pg_default;
