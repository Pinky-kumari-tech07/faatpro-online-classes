
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.support_ticket_seq TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(text, text, text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
