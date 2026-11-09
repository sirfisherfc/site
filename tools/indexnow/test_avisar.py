"""Testes offline do aviso IndexNow; sem rede."""

import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("avisar", Path(__file__).with_name("avisar.py"))
avisar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(avisar)

SITEMAP = ["https://www.sirfisher.com.br/", "https://www.sirfisher.com.br/cardapio/",
           "https://www.sirfisher.com.br/guia/beira-mar/"]


class IndexNowTest(unittest.TestCase):
    def test_mapeia_arquivos_para_urls(self):
        self.assertEqual(avisar.url_do_arquivo("index.html"), "https://www.sirfisher.com.br/")
        self.assertEqual(avisar.url_do_arquivo("guia/beira-mar/index.html"), "https://www.sirfisher.com.br/guia/beira-mar/")
        self.assertIsNone(avisar.url_do_arquivo("assets/css/style.css"))

    def test_so_envia_paginas_do_sitemap(self):
        arquivos = ["index.html", "conheca/index.html", "qr/index.html", "assets/js/x.js", "guia/beira-mar/index.html"]
        self.assertEqual(avisar.selecionar(arquivos, SITEMAP),
                         ["https://www.sirfisher.com.br/", "https://www.sirfisher.com.br/guia/beira-mar/"])

    def test_pedido_aponta_a_chave_publicada(self):
        corpo = avisar.pedido(["https://www.sirfisher.com.br/"], "a" * 32)
        self.assertEqual(corpo["host"], "www.sirfisher.com.br")
        self.assertEqual(corpo["keyLocation"], "https://www.sirfisher.com.br/" + "a" * 32 + ".txt")

    def test_commit_vazio_nao_lista_nada(self):
        self.assertEqual(avisar.alterados_desde("0000000000000000000000000000000000000000"), [])
        self.assertEqual(avisar.alterados_desde(""), [])

    def test_exige_um_unico_arquivo_de_chave_valido(self):
        with tempfile.TemporaryDirectory() as d:
            raiz = Path(d)
            (raiz / ("b" * 32 + ".txt")).write_text("b" * 32, encoding="utf-8")
            (raiz / "robots.txt").write_text("User-agent: *", encoding="utf-8")
            self.assertEqual(avisar.chave(raiz), "b" * 32)
            (raiz / ("c" * 32 + ".txt")).write_text("c" * 32, encoding="utf-8")
            with self.assertRaises(SystemExit):
                avisar.chave(raiz)

    def test_chave_real_do_site_e_o_sitemap_existem(self):
        self.assertRegex(avisar.chave(), r"^[0-9a-f]{32}$")
        self.assertIn("https://www.sirfisher.com.br/", avisar.urls_do_sitemap())


if __name__ == "__main__":
    unittest.main()
