"""A informacao alimentar deve sobreviver ao canal sem pictogramas."""
import unittest
from build_google_menu import build_menu


class GoogleMenuTest(unittest.TestCase):
    def product(self, **changes):
        return dict({'nome':'Produto', 'categoria':'pratos', 'preco':{'centavos':1234},
                     'alimentar':{'declarados':['LEITE','LACTOSE']}, 'descricao':'Receita.'}, **changes)

    def items(self, product):
        return build_menu({'categorias':[{'id':'pratos','nome':'Pratos'}], 'produtos':[product]})['menus'][0]['sections'][0]['items']

    def test_separate_milk_and_lactose_reach_each_price_option(self):
        item=self.items(self.product(variantes=[{'nome':'Pequeno','preco_centavos':1200}, {'nome':'Grande','preco_centavos':2200}]))[0]
        for version in [item]+item['options']:
            text=version['labels'][0]['description']
            self.assertIn('Contém: LEITE, LACTOSE.',text)
            self.assertIn('contaminação cruzada',text)
        self.assertEqual(item['options'][0]['attributes']['price']['units'],22)

    def test_no_symbols_does_not_become_allergen_free_claim(self):
        item=self.items(self.product(alimentar={'declarados':[]}))[0]
        self.assertEqual(item['labels'][0]['description'],'Receita.')
        self.assertNotIn('Contém:',item['labels'][0]['description'])

    def test_unavailable_and_service_items_stay_out(self):
        for changes in ({'disponivel':False},{'etiquetas':['servico']}):
            menu=build_menu({'categorias':[{'id':'pratos','nome':'Pratos'}], 'produtos':[self.product(**changes)]})
            self.assertEqual(menu['menus'][0]['sections'],[])


if __name__=='__main__': unittest.main()
