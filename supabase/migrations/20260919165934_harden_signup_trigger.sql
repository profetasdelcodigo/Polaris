-- SECURITY: this trigger function is not an RPC endpoint.
-- Explicit role revocations avoid grants inherited from default function ACLs.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
