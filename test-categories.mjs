import { getCategoriesForChatbot } from './dist/services/productsService.js';

async function testCategories() {
  console.log('Probando getCategoriesForChatbot...');
  
  try {
    const categories = await getCategoriesForChatbot('afa60b0a-3046-4607-9c48-266af6e1d322');
    console.log('Categorías obtenidas:', categories);
    console.log('Cantidad:', categories.length);
  } catch (error) {
    console.error('Error:', error);
  }
}

testCategories();