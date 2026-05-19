import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, Pencil, Trash2, ArrowLeft, ChevronDown, ChevronUp, Settings } from "lucide-react";
import logo from "../../imports/image.png";
import ImageUpload from "../components/ImageUpload";
import { useAuth } from "../contexts/AuthContext";
import { api, type Category, type MenuItem } from "../lib/api";
import UserAccountMenu from "../components/UserAccountMenu";

type ModalType = "category" | "item" | null;

export default function AdminMenu() {
  const { token } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id))
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(() => {
    const saved = localStorage.getItem("ukiyo_show_thumbnails");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });

  const [itemForm, setItemForm] = useState({
    categoryId: "",
    name: "",
    description: "",
    price: "",
    available: true,
    image: null as string | null,
  });

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const [loadedCategories, loadedItems] = await Promise.all([
          api.getCategories(),
          api.getMenuItems(),
        ]);
        setCategories(loadedCategories);
        setMenu(loadedItems);
        setExpandedCategories(new Set(loadedCategories.map((category) => category.id)));
      } catch (error) {
        console.error(error);
        alert("Não foi possível carregar o cardápio");
      } finally {
        setIsLoadingMenu(false);
      }
    };

    loadMenu();
  }, []);

  const openCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: "",
        description: "",
      });
    }
    setModalType("category");
  };

  const openItemModal = (categoryId: string, item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        price: item.price.toString(),
        available: item.available,
        image: item.image ?? null,
      });
    } else {
      setEditingItem(null);
      setItemForm({
        categoryId,
        name: "",
        description: "",
        price: "",
        available: true,
        image: null,
      });
    }
    setModalType("item");
  };

  const saveCategory = async () => {
    if (!categoryForm.name) {
      alert("Preencha o nome da categoria");
      return;
    }

    const categoryData = {
      name: categoryForm.name,
      description: categoryForm.description,
      order: editingCategory?.order || categories.length + 1,
    };

    try {
      if (editingCategory) {
        const updatedCategory = await api.updateCategory(editingCategory.id, categoryData, token);
        setCategories((prev) =>
          prev.map((cat) => (cat.id === editingCategory.id ? updatedCategory : cat))
        );
      } else {
        const newCategory = await api.createCategory(categoryData, token);
        setCategories((prev) => [...prev, newCategory]);
        setExpandedCategories((prev) => new Set([...prev, newCategory.id]));
      }
      setModalType(null);
    } catch (error) {
      console.error(error);
      alert("Não foi possível salvar a categoria");
    }
  };

  const saveItem = async () => {
    if (!itemForm.name || !itemForm.price || !itemForm.categoryId) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }

    const itemData = {
      categoryId: itemForm.categoryId,
      name: itemForm.name,
      description: itemForm.description,
      price: parseFloat(itemForm.price),
      available: itemForm.available,
      image: itemForm.image ?? null,
    };

    try {
      if (editingItem) {
        const updatedItem = await api.updateMenuItem(editingItem.id, itemData, token);
        setMenu((prev) =>
          prev.map((item) => (item.id === editingItem.id ? updatedItem : item))
        );
      } else {
        const newItem = await api.createMenuItem(itemData, token);
        setMenu((prev) => [...prev, newItem]);
      }
      setModalType(null);
    } catch (error) {
      console.error(error);
      alert("Não foi possível salvar o item");
    }
  };

  const toggleShowThumbnails = () => {
    const newValue = !showThumbnails;
    setShowThumbnails(newValue);
    localStorage.setItem("ukiyo_show_thumbnails", JSON.stringify(newValue));
  };

  const deleteCategory = async (id: string) => {
    const hasItems = menu.some((item) => item.categoryId === id);
    if (hasItems) {
      alert("Não é possível excluir uma categoria que contém itens");
      return;
    }
    if (confirm("Deseja realmente excluir esta categoria?")) {
      try {
        await api.deleteCategory(id, token);
        setCategories((prev) => prev.filter((cat) => cat.id !== id));
      } catch (error) {
        console.error(error);
        alert("Não foi possível excluir a categoria");
      }
    }
  };

  const deleteItem = async (id: string) => {
    if (confirm("Deseja realmente excluir este item?")) {
      try {
        await api.deleteMenuItem(id, token);
        setMenu((prev) => prev.filter((item) => item.id !== id));
      } catch (error) {
        console.error(error);
        alert("Não foi possível excluir o item");
      }
    }
  };

  const toggleItemAvailability = async (id: string) => {
    const item = menu.find((menuItem) => menuItem.id === id);
    if (!item) return;

    try {
      const updatedItem = await api.updateMenuItem(id, { available: !item.available }, token);
      setMenu((prev) =>
        prev.map((menuItem) => (menuItem.id === id ? updatedItem : menuItem))
      );
    } catch (error) {
      console.error(error);
      alert("Não foi possível atualizar o item");
    }
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-black text-white p-6 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <img src={logo} alt="Ukiyo" className="w-16 h-16 object-contain" />
            <div>
              <h1>Gerenciar Cardápio</h1>
              <p className="text-sm opacity-80">
                Organize categorias e adicione itens
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="bg-secondary text-secondary-foreground px-4 py-3 rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-2"
              title="Configurações do cardápio"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => openCategoryModal()}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nova Categoria
            </button>
            <UserAccountMenu />
          </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="max-w-7xl mx-auto p-6">
        {isLoadingMenu && (
          <div className="text-center py-12 text-muted-foreground">
            Carregando cardápio...
          </div>
        )}

        <div className="space-y-4">
          {sortedCategories.map((category) => {
            const categoryItems = menu.filter(
              (item) => item.categoryId === category.id
            );
            const isExpanded = expandedCategories.has(category.id);

            return (
              <div
                key={category.id}
                className="bg-card border border-border rounded-lg overflow-hidden"
              >
                {/* Category Header */}
                <div className="bg-secondary/30 p-4">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex-1 cursor-pointer flex items-center gap-3"
                      onClick={() => toggleCategory(category.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-primary" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-primary" />
                      )}
                      <div>
                        <h2 className="text-primary">{category.name}</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {category.description} • {categoryItems.length}{" "}
                          {categoryItems.length === 1 ? "item" : "itens"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openItemModal(category.id)}
                        className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Item
                      </button>
                      <button
                        onClick={() => openCategoryModal(category)}
                        className="p-2 hover:bg-secondary rounded-md transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id)}
                        className="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Category Items */}
                {isExpanded && (
                  <div className="p-4">
                    {categoryItems.length > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {categoryItems.map((item) => (
                          <div
                            key={item.id}
                            className={`border border-border rounded-lg p-4 ${
                              !item.available ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <h3>{item.name}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {item.description}
                                </p>
                                <div className="text-primary mt-2">
                                  R$ {item.price.toFixed(2)}
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <button
                                  onClick={() => openItemModal(category.id, item)}
                                  className="p-2 hover:bg-secondary rounded-md transition-colors"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => deleteItem(item.id)}
                                  className="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleItemAvailability(item.id)}
                              className={`w-full py-2 px-4 rounded-md transition-colors text-sm ${
                                item.available
                                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                              }`}
                            >
                              {item.available ? "✓ Disponível" : "✕ Indisponível"}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Nenhum item nesta categoria. Clique em "+ Item" para
                        adicionar.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {categories.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma categoria cadastrada. Clique em "Nova Categoria" para
              começar.
            </div>
          )}
        </div>
      </div>

      {/* Category Modal */}
      {modalType === "category" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block mb-2">Nome *</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Ex: Temakis"
                />
              </div>

              <div>
                <label className="block mb-2">Descrição</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none"
                  placeholder="Descreva a categoria..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-border flex gap-3 justify-end">
              <button
                onClick={() => setModalType(null)}
                className="px-6 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveCategory}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                {editingCategory ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {modalType === "item" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h2>{editingItem ? "Editar Item" : "Novo Item"}</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block mb-2">Categoria *</label>
                <select
                  value={itemForm.categoryId}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, categoryId: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2">Nome *</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Ex: Temaki de Salmão"
                />
              </div>

              <div>
                <label className="block mb-2">Descrição</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, description: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none"
                  placeholder="Descreva o item..."
                />
              </div>

              <div>
                <label className="block mb-2">Preço (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={itemForm.price}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, price: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-2">Imagem</label>
	                <ImageUpload
	                  value={itemForm.image}
	                  onChange={(imageUrl) =>
	                    setItemForm({ ...itemForm, image: imageUrl })
	                  }
	                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="item-available"
                  checked={itemForm.available}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, available: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <label htmlFor="item-available" className="cursor-pointer">
                  Item disponível para pedidos
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-border flex gap-3 justify-end">
              <button
                onClick={() => setModalType(null)}
                className="px-6 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveItem}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                {editingItem ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Drawer */}
      {showSettings && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowSettings(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-80 bg-background z-50 shadow-2xl flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex justify-between items-center">
                <h2>Configurações</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="mb-4">Visualização do Cardápio</h3>
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label
                        htmlFor="show-thumbnails"
                        className="cursor-pointer block"
                      >
                        Mostrar Miniaturas
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Exibe imagens dos itens no cardápio para os clientes
                      </p>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="show-thumbnails"
                        checked={showThumbnails}
                        onChange={toggleShowThumbnails}
                        className="w-5 h-5 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
