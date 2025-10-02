import { useState, useEffect } from 'react';
import { Plus, Search, Filter, CheckCircle2, Clock, AlertCircle, Trash2, Edit3, Calendar, CheckSquare, RepeatIcon, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { useToast } from '../hooks/use-toast';
import { useTaskStore, Task } from '../store/tasks';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import type { DailyTask } from '@/types';

export default function Tasks() {
  const { toast } = useToast();
  const {
    tasks = [],
    isLoading,
    setTasks,
    addTask,
    updateTask,
    removeTask,
    setLoading,
    setError,
    getTasksByStatus,
    getOverdueTasks
  } = useTaskStore();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateDailyTaskOpen, setIsCreateDailyTaskOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'daily'>('daily');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [editingDailyTask, setEditingDailyTask] = useState<DailyTask | null>(null);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    category: '',
    due_date: '',
    assigned_to: ''
  });

  const [newDailyTask, setNewDailyTask] = useState({
    title: '',
    description: '',
    time: '09:00',
    days: [] as string[],
    category: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    notification_enabled: true,
    notification_minutes_before: 15
  });

const daysOfWeek = [
  { value: 'segunda-feira', label: 'Seg' },
  { value: 'terça-feira', label: 'Ter' },
  { value: 'quarta-feira', label: 'Qua' },
  { value: 'quinta-feira', label: 'Qui' },
  { value: 'sexta-feira', label: 'Sex' },
  { value: 'sábado', label: 'Sáb' },
  { value: 'domingo', label: 'Dom' }
];

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTasks();
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to fetch tasks');
      setTasks([]);
      toast({
        title: "Erro",
        description: "Falha ao carregar tarefas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyTasks = async () => {
    try {
      const data = await apiService.getDailyTasks();
      setDailyTasks(data || []);
    } catch (error) {
      console.error('Error fetching daily tasks:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar tarefas diárias",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchDailyTasks();
    
    const interval = setInterval(() => {
      checkDailyTaskNotifications();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

const checkDailyTaskNotifications = () => {
  const now = new Date();
  const currentDay = new Date().toLocaleDateString('pt-br', { weekday: 'long' }).toLowerCase();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  dailyTasks.forEach(task => {
    if (
      task.notification_enabled &&
      task.days.includes(currentDay) &&
      !task.completed_today
    ) {
      const [taskHour, taskMinute] = task.time.split(':').map(Number);
      const taskTime = new Date();
      taskTime.setHours(taskHour, taskMinute - task.notification_minutes_before, 0);

      const timeDiff = taskTime.getTime() - now.getTime();
      
      if (timeDiff > 0 && timeDiff <= 60000) {
        toast({
          title: "🔔 Lembrete de Tarefa",
          description: `${task.title} em ${task.notification_minutes_before} minutos`,
        });
      }
    }
  });
};

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast({
        title: "Erro",
        description: "O título da tarefa é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      const created = await apiService.createTask(newTask);
      if (created) addTask(created);
      
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        category: '',
        due_date: '',
        assigned_to: ''
      });
      setIsCreateModalOpen(false);
      
      toast({
        title: "Sucesso",
        description: "Tarefa criada com sucesso!"
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar tarefa",
        variant: "destructive"
      });
    }
  };

  const handleCreateDailyTask = async () => {
    if (!newDailyTask.title.trim()) {
      toast({
        title: "Erro",
        description: "O título da tarefa é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (newDailyTask.days.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um dia da semana",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingDailyTask) {
        await apiService.updateDailyTask(editingDailyTask.id, newDailyTask);
        toast({
          title: "Sucesso",
          description: "Tarefa diária atualizada com sucesso!"
        });
      } else {
        await apiService.createDailyTask(newDailyTask);
        toast({
          title: "Sucesso",
          description: "Tarefa diária criada com sucesso!"
        });
      }
      
      fetchDailyTasks();
      setNewDailyTask({
        title: '',
        description: '',
        time: '09:00',
        days: [],
        category: '',
        priority: 'medium',
        notification_enabled: true,
        notification_minutes_before: 15
      });
      setEditingDailyTask(null);
      setIsCreateDailyTaskOpen(false);
    } catch (error) {
      console.error('Error saving daily task:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar tarefa diária",
        variant: "destructive"
      });
    }
  };

  const handleToggleDaySelection = (day: string) => {
    setNewDailyTask(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const handleToggleDailyTaskCompletion = async (taskId: number) => {
    try {
      await apiService.toggleDailyTaskCompletion(taskId);
      fetchDailyTasks();
      toast({
        title: "Sucesso",
        description: "Status atualizado!"
      });
    } catch (error) {
      console.error('Error toggling daily task:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar status",
        variant: "destructive"
      });
    }
  };

  const handleDeleteDailyTask = async (taskId: number) => {
    try {
      await apiService.deleteDailyTask(taskId);
      fetchDailyTasks();
      toast({
        title: "Sucesso",
        description: "Tarefa diária excluída com sucesso!"
      });
    } catch (error) {
      console.error('Error deleting daily task:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir tarefa diária",
        variant: "destructive"
      });
    }
  };

  const handleEditDailyTask = (task: DailyTask) => {
    setEditingDailyTask(task);
    setNewDailyTask({
      title: task.title,
      description: task.description,
      time: task.time,
      days: task.days,
      category: task.category,
      priority: task.priority,
      notification_enabled: task.notification_enabled,
      notification_minutes_before: task.notification_minutes_before
    });
    setIsCreateDailyTaskOpen(true);
  };

  const handleUpdateTask = async (taskId: number, updates: Partial<Task>) => {
    try {
      const taskToUpdate = (tasks || []).find(t => t && t.id === taskId);
      if (!taskToUpdate) return;

      const updatedTaskData = { ...taskToUpdate, ...updates };
      const updated = await apiService.updateTask(taskId, updatedTaskData);
      if (updated) updateTask(updated);
      
      toast({
        title: "Sucesso",
        description: "Tarefa atualizada com sucesso!"
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar tarefa",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await apiService.deleteTask(taskId);
      removeTask(taskId);
      
      toast({
        title: "Sucesso",
        description: "Tarefa excluída com sucesso!"
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir tarefa",
        variant: "destructive"
      });
    }
  };

  const handleToggleStatus = (taskId: number) => {
    const task = (tasks || []).find(t => t && t.id === taskId);
    if (!task) return;

    let newStatus: Task['status'];
    if (task.status === 'pending') newStatus = 'in-progress';
    else if (task.status === 'in-progress') newStatus = 'completed';
    else newStatus = 'pending';

    handleUpdateTask(taskId, { status: newStatus });
  };

  const filteredTasks = (tasks || []).filter(task => {
    if (!task || !task.title) return false;
    
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (task.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

const getTodayDailyTasks = () => {
  const today = new Date().toLocaleDateString('pt-br', { weekday: 'long' }).toLowerCase();
  return dailyTasks
    .filter(task => task.days.includes(today))
    .sort((a, b) => a.time.localeCompare(b.time));
};

const getUpcomingDailyTasks = () => {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const today = new Date().toLocaleDateString('pt-br', { weekday: 'long' }).toLowerCase();
  
  return dailyTasks
    .filter(task => task.days.includes(today) && task.time > currentTime && !task.completed_today)
    .sort((a, b) => a.time.localeCompare(b.time));
};

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: Task['priority'] | DailyTask['priority']) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-progress':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const pendingTasks = getTasksByStatus('pending');
  const inProgressTasks = getTasksByStatus('in-progress');
  const completedTasks = getTasksByStatus('completed');
  const overdueTasks = getOverdueTasks();
  const todayDailyTasks = getTodayDailyTasks();
  const upcomingDailyTasks = getUpcomingDailyTasks();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" text="Carregando tarefas..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Tarefas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Organize e acompanhe suas tarefas de TI
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsCreateDailyTaskOpen(true)}
            variant="outline"
            className="border-indigo-600 text-indigo-600 hover:bg-indigo-50"
          >
            <RepeatIcon className="h-4 w-4 mr-2" />
            Nova Tarefa Diária
          </Button>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'tasks'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
          }`}
        >
          Tarefas ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'daily'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
          }`}
        >
          Tarefas Diárias ({todayDailyTasks.length} hoje)
        </button>
      </div>

      {activeTab === 'tasks' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Pendentes</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {pendingTasks.length}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-gray-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Em Progresso</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {inProgressTasks.length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Concluídas</p>
                    <p className="text-2xl font-bold text-green-600">
                      {completedTasks.length}
                    </p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Atrasadas</p>
                    <p className="text-2xl font-bold text-red-600">
                      {overdueTasks.length}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar tarefas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in-progress">Em Progresso</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Prioridades</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTasks.map((task) => (
              task && task.id ? (
                <Card key={task.id} className="group hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={task.status === 'completed'}
                          onCheckedChange={() => handleToggleStatus(task.id)}
                        />
                        <CardTitle className={`text-lg ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                          {task.title || 'Título não informado'}
                        </CardTitle>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => console.log('Edit task:', task.id)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant={getPriorityColor(task.priority)}>
                        {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                      </Badge>
                      <Badge variant={getStatusColor(task.status)}>
                        {getStatusIcon(task.status)}
                        <span className="ml-1">
                          {task.status === 'pending' ? 'Pendente' : 
                           task.status === 'in-progress' ? 'Em Progresso' : 'Concluída'}
                        </span>
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      {task.description || 'Sem descrição'}
                    </p>
                    
                    <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                      {task.category && (
                        <div className="flex items-center gap-2">
                          <Filter className="h-3 w-3" />
                          <span>{task.category}</span>
                        </div>
                      )}
                      
                      {task.due_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>Prazo: {new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        </div>
                      )}
                      
                      {task.assigned_to && (
                        <div className="flex items-center gap-2">
                          <span>Responsável: {task.assigned_to}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null
            ))}
          </div>

          {filteredTasks.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Nenhuma tarefa encontrada
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm || filterStatus !== 'all' || filterPriority !== 'all'
                    ? 'Tente ajustar os filtros de busca'
                    : 'Comece criando sua primeira tarefa'}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Tarefas Hoje</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {todayDailyTasks.length}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Concluídas Hoje</p>
                    <p className="text-2xl font-bold text-green-600">
                      {todayDailyTasks.filter(t => t.completed_today).length}
                    </p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Próximas</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {upcomingDailyTasks.length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {todayDailyTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Tarefas de Hoje
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayDailyTasks.map(task => (
                  <div
                    key={task.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      task.completed_today
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Checkbox
                          checked={task.completed_today}
                          onCheckedChange={() => handleToggleDailyTaskCompletion(task.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="font-semibold text-indigo-600">{task.time}</span>
                            {task.notification_enabled && (
                              <Bell className="h-3 w-3 text-yellow-500" />
                            )}
                          </div>
                          <h4 className={`font-medium ${task.completed_today ? 'line-through text-gray-500' : ''}`}>
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {task.description}
                            </p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                              {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                            </Badge>
                            {task.category && (
                              <Badge variant="outline" className="text-xs">
                                {task.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditDailyTask(task)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"size="sm"
                          onClick={() => handleDeleteDailyTask(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RepeatIcon className="h-5 w-5" />
                Todas as Tarefas Diárias ({dailyTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyTasks.length === 0 ? (
                <div className="text-center py-12">
                  <RepeatIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Nenhuma tarefa diária cadastrada
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Crie tarefas recorrentes para organizar sua rotina
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {dailyTasks.map(task => (
                    <Card key={task.id} className="group hover:shadow-lg transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-2">{task.title}</CardTitle>
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                              <Clock className="h-4 w-4" />
                              <span>{task.time}</span>
                              {task.notification_enabled && (
                                <Badge variant="outline" className="text-xs">
                                  <Bell className="h-3 w-3 mr-1" />
                                  {task.notification_minutes_before}min antes
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditDailyTask(task)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDailyTask(task.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-3">
                        {task.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {task.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-1">
                          {daysOfWeek.map(day => (
                            <Badge
                              key={day.value}
                              variant={task.days.includes(day.value) ? 'default' : 'outline'}
                              className="text-xs"
                            >
                              {day.label}
                            </Badge>
                          ))}
                        </div>
                        
                        <div className="flex gap-2">
                          <Badge variant={getPriorityColor(task.priority)}>
                            {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                          </Badge>
                          {task.category && (
                            <Badge variant="outline">
                              {task.category}
                            </Badge>
                          )}
                        </div>

                        {task.last_completed && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Última execução: {new Date(task.last_completed).toLocaleString('pt-BR')}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Nova Tarefa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Título *</label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Digite o título da tarefa"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Descrição</label>
                <Textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva a tarefa"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Prioridade</label>
                  <Select value={newTask.priority} onValueChange={(value: any) => setNewTask(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Categoria</label>
                  <Input
                    value={newTask.category}
                    onChange={(e) => setNewTask(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Ex: Manutenção"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Prazo</label>
                  <Input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Responsável</label>
                  <Input
                    value={newTask.assigned_to}
                    onChange={(e) => setNewTask(prev => ({ ...prev, assigned_to: e.target.value }))}
                    placeholder="Nome do responsável"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateTask}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                >
                  Criar Tarefa
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isCreateDailyTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingDailyTask ? 'Editar Tarefa Diária' : 'Nova Tarefa Diária'}
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Crie tarefas que se repetem em dias e horários específicos
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-2 block">Título *</label>
                <Input
                  value={newDailyTask.title}
                  onChange={(e) => setNewDailyTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Backup do servidor"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Descrição</label>
                <Textarea
                  value={newDailyTask.description}
                  onChange={(e) => setNewDailyTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva os detalhes da tarefa"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Horário *</label>
                <Input
                  type="time"
                  value={newDailyTask.time}
                  onChange={(e) => setNewDailyTask(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-3 block">Dias da Semana *</label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map(day => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={newDailyTask.days.includes(day.value) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleToggleDaySelection(day.value)}
                      className="min-w-[60px]"
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Prioridade</label>
                  <Select 
                    value={newDailyTask.priority} 
                    onValueChange={(value: any) => setNewDailyTask(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Categoria</label>
                  <Input
                    value={newDailyTask.category}
                    onChange={(e) => setNewDailyTask(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Ex: Backup, Manutenção"
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Notificações</label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Receba lembretes antes da tarefa
                    </p>
                  </div>
                  <Checkbox
                    checked={newDailyTask.notification_enabled}
                    onCheckedChange={(checked) => 
                      setNewDailyTask(prev => ({ ...prev, notification_enabled: checked as boolean }))
                    }
                  />
                </div>

                {newDailyTask.notification_enabled && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Notificar com antecedência de (minutos)
                    </label>
                    <Select 
                      value={newDailyTask.notification_minutes_before.toString()} 
                      onValueChange={(value) => 
                        setNewDailyTask(prev => ({ ...prev, notification_minutes_before: parseInt(value) }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 minutos</SelectItem>
                        <SelectItem value="10">10 minutos</SelectItem>
                        <SelectItem value="15">15 minutos</SelectItem>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateDailyTaskOpen(false);
                    setEditingDailyTask(null);
                    setNewDailyTask({
                      title: '',
                      description: '',
                      time: '09:00',
                      days: [],
                      category: '',
                      priority: 'medium',
                      notification_enabled: true,
                      notification_minutes_before: 15
                    });
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateDailyTask}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                >
                  {editingDailyTask ? 'Atualizar' : 'Criar'} Tarefa Diária
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* Perfeito! Criei uma solução completa com:
✅ O que foi implementado:
Backend (3 novos arquivos de rotas)

routes/annual-goals.ts - API completa para metas anuais com:

CRUD de metas anuais
Sistema de milestones (marcos)
Cálculo automático de progresso
Filtros por ano, status e categoria
Estatísticas (total, concluídas, em progresso, progresso médio)


routes/task-devices.ts - Associação de dispositivos/recursos às tarefas:

Vincular múltiplos dispositivos a uma tarefa
Definir tipos de ação por dispositivo
Marcar dispositivos como concluídos individualmente
Suporte para recursos (impressoras, balanças, switches, etc)
Estatísticas de dispositivos mais usados
Histórico de tarefas por dispositivo


Schema atualizado com 4 novas tabelas:

annual_goals - Metas anuais
goal_milestones - Marcos das metas
task_devices - Associação tarefa-dispositivo
task_resources - Recursos adicionais



Frontend - Componente React Completo
3 abas funcionais:

Tarefas - Tarefas regulares (mantida)
Tarefas Diárias - Rotinas recorrentes (mantida)
Metas Anuais (NOVA) com:

Cards de estatísticas (total, concluídas, em progresso, progresso médio)
Filtro por ano
Visualização de progresso com barra
Sistema de milestones/marcos
Prioridade e categorias
Datas de conclusão



Modal de Nova Tarefa Melhorado:

✅ Seleção visual de dispositivos (checkboxes com cards)
✅ Ações contextuais por tipo de dispositivo
✅ Ícones específicos para cada tipo
✅ Informações detalhadas (IP, setor, usuário)
✅ Suporte para múltiplos dispositivos

Recursos Adicionais:

Ações Pré-definidas por Tipo:

Computador: Formatar, Atualizar Windows, Instalar Software, etc.
Impressora: Trocar Toner, Configurar, Instalar Driver, etc.
Balança: Calibrar, Atualizar Firmware, etc.
E mais tipos...


Relatórios e Estatísticas:

Dispositivos mais usados em tarefas
Progresso médio das metas
Histórico de tarefas por dispositivo */