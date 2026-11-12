-- APAGA DEFINITIVAMENTE os certificados emitidos. Nao tem desfazer.
-- Rodar no Supabase SQL Editor (papel postgres). O painel nao apaga: certificado so pode ser revogado.
-- Nao mexe em alunos, turmas, matriculas, treinamentos nem assinaturas padrao.
-- O audit_log e imutavel e continua registrando as emissoes e as exclusoes.
-- Os arquivos PDF NAO saem daqui: apague-os em Storage > certificates (ver o fim deste arquivo).

-- 1) Conferir antes (so leitura):
select status, count(*) from public.certificates group by status;

-- 2) Apagar. Tudo ou nada: se algo falhar, nada e apagado.
begin;
delete from public.certificates;
-- para apagar so alguns, troque a linha acima, por exemplo:
--   delete from public.certificates where code in ('CODIGO1', 'CODIGO2');
select count(*) as restantes from public.certificates;
commit;

-- 3) PDFs: Storage > bucket "certificates" > selecionar tudo > Delete.
--    (Apagar linhas de storage.objects por SQL deixa os arquivos orfaos no armazenamento.)
