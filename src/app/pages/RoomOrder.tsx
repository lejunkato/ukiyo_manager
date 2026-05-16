import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { ShoppingCart, Plus, Minus, Users, Receipt, X, ChevronDown, ChevronUp } from "lucide-react";
import logo from "../../imports/image.png";
import { api, type Category, type MenuItem, type Room, type RoomSummary, type Tab } from "../lib/api";

interface CartItem extends MenuItem {
  quantity: number;
  observations?: string;
}

type TabInfo = Pick<Tab, "id" | "tabName" | "personName">;

interface TabStatus {
  tabName: string;
  personName: string;
  totalValue: number;
  paid: boolean;
  roomChargePaid: number;
  items: { name: string; quantity: number; price: number }[];
}

export default function RoomOrder() {
  const { roomId } = useParams();
  const [selectedTab, setSelectedTab] = useState<TabInfo | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [existingTabs, setExistingTabs] = useState<TabInfo[]>([]);
  const [tabsStatus, setTabsStatus] = useState<TabStatus[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showTabSelection, setShowTabSelection] = useState(true);
  const [showAccountSummary, setShowAccountSummary] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [showNewTabForm, setShowNewTabForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemObservations, setItemObservations] = useState("");

  const [showThumbnails, setShowThumbnails] = useState(() => {
    const saved = localStorage.getItem("ukiyo_show_thumbnails");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(new Set());

  const currentTabStatus = tabsStatus.find((tab) => tab.tabName === selectedTab?.tabName);
  const totalSpent = currentTabStatus?.totalValue ?? 0;
  const toggleTab = (tabName: string) => {
    setExpandedTabs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tabName)) {
        newSet.delete(tabName);
      } else {
        newSet.add(tabName);
      }
      return newSet;
    });
  };

  useEffect(() => {
    const loadData = async () => {
      if (!roomId) return;

      try {
        const [loadedRoom, loadedCategories, loadedItems, loadedTabs, summary] = await Promise.all([
          api.getRoom(roomId),
          api.getCategories(),
          api.getMenuItems(),
          api.getTabs(roomId),
          api.getRoomSummary(roomId),
        ]);

        setRoom(loadedRoom);
        setCategories(loadedCategories);
        setMenu(loadedItems.filter((item) => item.available));
        setExistingTabs(loadedTabs.map((tab) => ({
          id: tab.id,
          tabName: tab.tabName,
          personName: tab.personName,
        })));
        setTabsStatus(summary.tabs);

        const savedTab = localStorage.getItem(`ukiyo_tab_${roomId}`);
        if (savedTab) {
          const tabInfo: TabInfo = JSON.parse(savedTab);
          const freshTab = loadedTabs.find((tab) => tab.id === tabInfo.id);
          if (freshTab) {
            setSelectedTab({
              id: freshTab.id,
              tabName: freshTab.tabName,
              personName: freshTab.personName,
            });
            setShowTabSelection(false);
          }
        }
      } catch (error) {
        console.error(error);
        alert("Não foi possível carregar a sala");
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [roomId]);

  const refreshSummary = async () => {
    if (!roomId) return;
    const summary: RoomSummary = await api.getRoomSummary(roomId);
    setTabsStatus(summary.tabs);
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("ukiyo_show_thumbnails");
      setShowThumbnails(saved !== null ? JSON.parse(saved) : true);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const addToCart = (item: MenuItem, observations?: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id && i.observations === observations);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id && i.observations === observations
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1, observations }];
    });
    setSelectedItem(null);
    setItemObservations("");
  };

  const removeFromCart = (itemId: string, observations?: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === itemId && i.observations === observations);
      if (existing && existing.quantity > 1) {
        return prev.map((i) =>
          i.id === itemId && i.observations === observations
            ? { ...i, quantity: i.quantity - 1 }
            : i
        );
      }
      return prev.filter((i) => !(i.id === itemId && i.observations === observations));
    });
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const sendOrder = async () => {
    if (!roomId || !selectedTab) return;

    try {
      await api.createOrder({
        roomId,
        tabId: selectedTab.id,
        items: cart.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          observations: item.observations,
        })),
      });
      alert(
        `Pedido enviado!\n${roomId} - ${selectedTab?.tabName}\nTotal: R$ ${total.toFixed(2)}`
      );
      setCart([]);
      setShowCart(false);
      await refreshSummary();
    } catch (error) {
      console.error(error);
      alert("Não foi possível enviar o pedido");
    }
  };

  const selectTab = (tab: TabInfo) => {
    setSelectedTab(tab);
    if (roomId) {
      localStorage.setItem(`ukiyo_tab_${roomId}`, JSON.stringify(tab));
    }
    setShowTabSelection(false);
  };

  const createNewTab = async () => {
    if (!newTabName || !newPersonName) {
      alert("Preencha o nome da comanda e da pessoa");
      return;
    }
    if (!roomId) return;

    try {
      const newTab = await api.createTab(roomId, {
        tabName: newTabName,
        personName: newPersonName,
      });
      const tabInfo = {
        id: newTab.id,
        tabName: newTab.tabName,
        personName: newTab.personName,
      };
      setExistingTabs((prev) => [...prev, tabInfo]);
      setNewTabName("");
      setNewPersonName("");
      selectTab(tabInfo);
      await refreshSummary();
    } catch (error) {
      console.error(error);
      alert("Não foi possível criar a comanda");
    }
  };

  const changeTab = () => {
    if (roomId) {
      localStorage.removeItem(`ukiyo_tab_${roomId}`);
    }
    setSelectedTab(null);
    setShowTabSelection(true);
  };

  const openItemDetail = (item: MenuItem) => {
    setSelectedItem(item);
    setItemObservations("");
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showTabSelection) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Ukiyo" className="w-32 h-32 object-contain" />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-white mb-2">
              {roomId?.replace("-", " ").toUpperCase()}
            </h1>
            <p className="text-white/60">Selecione ou crie uma comanda</p>
          </div>

          {!showNewTabForm ? (
            <div className="space-y-3">
              {existingTabs.map((tab) => (
                <button
                  key={tab.tabName}
                  onClick={() => selectTab(tab)}
                  className="w-full bg-white text-black py-4 px-6 rounded-lg hover:bg-white/90 transition-colors flex items-center justify-between"
                >
                  <div className="text-left">
                    <div>{tab.tabName}</div>
                    <div className="text-sm opacity-60">{tab.personName}</div>
                  </div>
                  <Users className="w-5 h-5" />
                </button>
              ))}

              <button
                onClick={() => setShowNewTabForm(true)}
                className="w-full bg-primary text-primary-foreground py-4 px-6 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nova Comanda
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm mb-2 text-black">
                    Nome da Comanda
                  </label>
                  <input
                    type="text"
                    value={newTabName}
                    onChange={(e) => setNewTabName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-black"
                    placeholder="Ex: Comanda 3"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-black">
                    Seu Nome
                  </label>
                  <input
                    type="text"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-black"
                    placeholder="Ex: Ana Costa"
                  />
                </div>
              </div>

              <button
                onClick={createNewTab}
                className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Criar Comanda
              </button>

              <button
                onClick={() => setShowNewTabForm(false)}
                className="w-full bg-white text-black py-3 px-6 rounded-lg hover:bg-white/90 transition-colors"
              >
                Voltar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header Mobile */}
      <div className="bg-black text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <img src={logo} alt="Ukiyo" className="w-20 h-20 object-contain" />
          </div>
          <div className="text-right">
            <div className="opacity-80 text-sm">
              {roomId?.replace("-", " ")}
            </div>
            <div>{selectedTab?.tabName}</div>
            <div className="text-sm text-white/60">{selectedTab?.personName}</div>
            <button
              onClick={changeTab}
              className="text-primary text-sm mt-1 hover:underline"
            >
              Trocar comanda
            </button>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="p-4 space-y-6">
        <h1>Cardápio</h1>

        {categories.map((category) => {
          const categoryItems = menu.filter(
            (item) => item.categoryId === category.id
          );

          if (categoryItems.length === 0) return null;

          return (
            <div key={category.id} className="space-y-3">
              <h2 className="text-primary">{category.name}</h2>
              <div className="space-y-3">
                {categoryItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openItemDetail(item)}
                    className="w-full bg-card border border-border rounded-lg p-3 hover:bg-secondary/20 transition-colors text-left"
                  >
                    <div className="flex gap-3">
                      {showThumbnails && (
                        <div className="w-20 h-20 bg-secondary rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-3xl">🍱</span>
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="truncate">{item.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {item.description}
                        </p>
                        <div className="text-primary mt-2">
                          R$ {item.price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fixed Buttons */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-3">
        <button
          onClick={() => setShowAccountSummary(true)}
          className="bg-black text-white p-4 rounded-full shadow-lg hover:bg-black/90 transition-colors"
        >
          <Receipt className="w-6 h-6" />
        </button>
        <button
          onClick={() => setShowCart(true)}
          className="bg-primary text-primary-foreground p-4 rounded-full shadow-lg hover:bg-primary/90 transition-colors relative"
        >
          <ShoppingCart className="w-6 h-6" />
          {totalItems > 0 && (
            <div className="absolute -top-2 -right-2 bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">
              {totalItems}
            </div>
          )}
        </button>
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-20 flex items-end">
          <div className="bg-background w-full rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {showThumbnails && (
              <div className="relative">
                <div className="w-full h-48 bg-secondary flex items-center justify-center overflow-hidden">
                  {selectedItem.image ? (
                    <img
                      src={selectedItem.image}
                      alt={selectedItem.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-8xl">🍱</span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            {!showThumbnails && (
              <div className="p-4 border-b border-border flex justify-between items-center">
                <div />
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <h2>{selectedItem.name}</h2>
                <p className="text-muted-foreground mt-2">
                  {selectedItem.description}
                </p>
                <div className="text-primary mt-3">
                  R$ {selectedItem.price.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block mb-2">Observações</label>
                <textarea
                  value={itemObservations}
                  onChange={(e) => setItemObservations(e.target.value)}
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring h-24 resize-none"
                  placeholder="Ex: Sem wasabi, sem gengibre..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-border">
              <button
                onClick={() => addToCart(selectedItem, itemObservations || undefined)}
                className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Adicionar ao Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-20 flex items-end">
          <div className="bg-background w-full rounded-t-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="flex justify-between items-center">
                <div>
                  <h2>Seu Pedido</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedTab?.tabName}
                  </p>
                </div>
                <button onClick={() => setShowCart(false)}>✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length > 0 ? (
                cart.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="bg-card border border-border rounded-lg p-3"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1">
                        <h4>{item.name}</h4>
                        {item.observations && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Obs: {item.observations}
                          </p>
                        )}
                        <div className="text-sm text-muted-foreground mt-1">
                          R$ {item.price.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-primary">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeFromCart(item.id, item.observations)}
                          className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center hover:bg-secondary/80"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => addToCart(item, item.observations)}
                          className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Seu carrinho está vazio
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border space-y-3">
              <div className="flex justify-between items-center">
                <div>Total do Pedido</div>
                <div className="text-primary">R$ {total.toFixed(2)}</div>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={sendOrder}
                  className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Enviar Pedido
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Summary Modal */}
      {showAccountSummary && (
        <div className="fixed inset-0 bg-black/50 z-20 flex items-end">
          <div className="bg-background w-full rounded-t-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="flex justify-between items-center">
                <div>
                  <h2>Minha Comanda</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedTab?.tabName} - {selectedTab?.personName}
                  </p>
                </div>
                <button onClick={() => setShowAccountSummary(false)}>✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">
                  Total Consumido
                </div>
                <div className="text-primary">
                  R$ {totalSpent.toFixed(2)}
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="mb-3">Itens Consumidos</h3>
                <div className="space-y-2 text-sm">
                  {currentTabStatus?.items.length ? (
                    currentTabStatus.items.map((item) => (
                      <div key={item.name} className="flex justify-between">
                        <span>
                          {item.quantity}x {item.name}
                        </span>
                        <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">
                      Nenhum item consumido ainda
                    </div>
                  )}
                </div>
              </div>

              {cart.length > 0 && (
                <div className="bg-accent border border-border rounded-lg p-4">
                  <div className="text-sm mb-2">
                    Pedido Atual (não enviado)
                  </div>
                  <div className="text-primary">
                    R$ {total.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border">
              <button
                onClick={() => setShowAccountSummary(false)}
                className="w-full bg-secondary text-secondary-foreground py-3 px-4 rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
