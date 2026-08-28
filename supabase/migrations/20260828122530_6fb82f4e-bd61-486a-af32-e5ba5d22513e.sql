REVOKE EXECUTE ON FUNCTION public.send_stream_gift(uuid, integer, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_shop_item(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_item_equipped(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_stream_gift(uuid, integer, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_item_equipped(text) TO authenticated;