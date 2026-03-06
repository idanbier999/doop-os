ALTER TABLE public.agents
  ADD COLUMN owner_id TEXT CONSTRAINT agents_owner_id_fkey REFERENCES public."user"(id) ON DELETE SET NULL;

CREATE INDEX idx_agents_owner_id ON public.agents(owner_id);
CREATE INDEX idx_agents_workspace_owner ON public.agents(workspace_id, owner_id);
