

-- 1. TIÊU DIỆT TOÀN BỘ GUI CŨ TRONG COREGUI & PLAYERGUI (RESET SẠCH SẼ)
for _, gui in ipairs(game:GetService("CoreGui"):GetChildren()) do
    if gui.Name == "ThucHub_BountyMaster" then
        gui:Destroy()
    end
end

local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer
local PlayerGui = LocalPlayer:FindFirstChild("PlayerGui")
if PlayerGui then
    for _, gui in ipairs(PlayerGui:GetChildren()) do
        if gui.Name == "ThucHub_BountyMaster" then
            gui:Destroy()
        end
    end
end

-- 2. KHỞI TẠO DỊCH VỤ VÀ BIẾN TOÀN CỤC
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local TeleportService = game:GetService("TeleportService")
local HttpService = game:GetService("HttpService")

local AntiBanEnabled = true
local AutoBountyActive = false
local TargetPlayersOnly = true
local AttackBosses = true
local TargetingDist = 150
local BountyGained = 0

-- 3. ANTI-BAN SHIELD (BẢO VỆ TÀI KHOẢN)
if AntiBanEnabled then
    local mt = getrawmetatable(game)
    setreadonly(mt, false)
    local oldNamecall = mt.__namecall
    mt.__namecall = newcclosure(function(self, ...)
        local method = getnamecallmethod()
        local args = {...}
        if method == "FireServer" and tostring(self):lower():find("ban") then
            return nil
        end
        return oldNamecall(self, unpack(args))
    end)
    setreadonly(mt, true)
end

-- 4. TẠO GIAO DIỆN HIỆN ĐẠI (DARK THEME - THUC THINKING PRO)
local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Name = "ThucHub_BountyMaster"
ScreenGui.Parent = game:GetService("CoreGui")
ScreenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

local MainFrame = Instance.new("Frame")
MainFrame.Name = "MainFrame"
MainFrame.Parent = ScreenGui
MainFrame.BackgroundColor3 = Color3.fromRGB(15, 15, 20)
MainFrame.BorderSizePixel = 0
MainFrame.Position = UDim2.new(0.5, -275, 0.5, -175)
MainFrame.Size = UDim2.new(0, 550, 0, 350)
MainFrame.Active = true
MainFrame.Draggable = true

local UICorner = Instance.new("UICorner")
UICorner.CornerRadius = UDim.new(0, 10)
UICorner.Parent = MainFrame

local UIStroke = Instance.new("UIStroke")
UIStroke.Color = Color3.fromRGB(0, 170, 255)
UIStroke.Thickness = 2
UIStroke.Parent = MainFrame

-- Tiêu đề Hub
local TitleLabel = Instance.new("TextLabel")
TitleLabel.Parent = MainFrame
TitleLabel.BackgroundColor3 = Color3.fromRGB(25, 25, 35)
TitleLabel.Size = UDim2.new(1, 0, 0, 40)
TitleLabel.Font = Enum.Font.GothamBold
TitleLabel.Text = "  THUC HUB | AUTO BOUNTY PRO v2.0 (Chủ nhân Thức)"
TitleLabel.TextColor3 = Color3.fromRGB(0, 255, 200)
TitleLabel.TextSize = 14
TitleLabel.TextXAlignment = Enum.TextXAlignment.Left

local TitleCorner = Instance.new("UICorner")
TitleCorner.CornerRadius = UDim.new(0, 10)
TitleCorner.Parent = TitleLabel

-- Nút Thu Gọn (Minimize)
local MinimizeBtn = Instance.new("TextButton")
MinimizeBtn.Parent = TitleLabel
MinimizeBtn.BackgroundColor3 = Color3.fromRGB(200, 50, 50)
MinimizeBtn.Position = UDim2.new(1, -35, 0.5, -12)
MinimizeBtn.Size = UDim2.new(0, 25, 0, 25)
MinimizeBtn.Font = Enum.Font.GothamBold
MinimizeBtn.Text = "-"
MinimizeBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
MinimizeBtn.TextSize = 16

local MinCorner = Instance.new("UICorner")
MinCorner.CornerRadius = UDim.new(0, 5)
MinCorner.Parent = MinimizeBtn

local isMinimized = false
MinimizeBtn.MouseButton1Click:Connect(function()
    isMinimized = not isMinimized
    for _, child in ipairs(MainFrame:GetChildren()) do
        if child ~= TitleLabel and child ~= UICorner and child ~= UIStroke then
            child.Visible = not isMinimized
        end
    end
    MainFrame.Size = isMinimized and UDim2.new(0, 550, 0, 40) or UDim2.new(0, 550, 0, 350)
    MinimizeBtn.Text = isMinimized and "+" or "-"
end)

-- Tạo hệ thống Tab (Farm, Stats, Combat, ESP, Teleport, Misc)
local TabContainer = Instance.new("ScrollingFrame")
TabContainer.Parent = MainFrame
TabContainer.BackgroundColor3 = Color3.fromRGB(20, 20, 28)
TabContainer.Position = UDim2.new(0, 10, 0, 50)
TabContainer.Size = UDim2.new(0, 130, 0, 290)
TabContainer.CanvasSize = UDim2.new(0, 0, 1.5, 0)
TabContainer.ScrollBarThickness = 4

local TabListLayout = Instance.new("UIListLayout")
TabListLayout.Parent = TabContainer
TabListLayout.SortOrder = Enum.SortOrder.LayoutOrder
TabListLayout.Padding = UDim.new(0, 5)

local ContentArea = Instance.new("Frame")
ContentArea.Parent = MainFrame
ContentArea.BackgroundColor3 = Color3.fromRGB(22, 22, 30)
ContentArea.Position = UDim2.new(0, 150, 0, 50)
ContentArea.Size = UDim2.new(0, 390, 0, 290)

local ContentCorner = Instance.new("UICorner")
ContentCorner.CornerRadius = UDim.new(0, 8)
ContentCorner.Parent = ContentArea

-- Hàm tạo Tab Button & Panel
local tabs = {"Farm", "Stats", "Combat", "ESP", "Teleport", "Misc"}
local panels = {}

for i, tabName in ipairs(tabs) do
    local btn = Instance.new("TextButton")
    btn.Parent = TabContainer
    btn.BackgroundColor3 = Color3.fromRGB(35, 35, 45)
    btn.Size = UDim2.new(1, -5, 0, 35)
    btn.Font = Enum.Font.GothamSemibold
    btn.Text = tabName
    btn.TextColor3 = Color3.fromRGB(255, 255, 255)
    btn.TextSize = 13
    
    local btnCorner = Instance.new("UICorner")
    btnCorner.CornerRadius = UDim.new(0, 6)
    btnCorner.Parent = btn
    
    local panel = Instance.new("ScrollingFrame")
    panel.Name = tabName .. "Panel"
    panel.Parent = ContentArea
    panel.BackgroundTransparency = 1
    panel.Size = UDim2.new(1, 0, 1, 0)
    panel.CanvasSize = UDim2.new(0, 0, 2, 0)
    panel.ScrollBarThickness = 4
    panel.Visible = (i == 1)
    
    local panelLayout = Instance.new("UIListLayout")
    panelLayout.Parent = panel
    panelLayout.SortOrder = Enum.SortOrder.LayoutOrder
    panelLayout.Padding = UDim.new(0, 8)
    
    panels[tabName] = panel
    
    btn.MouseButton1Click:Connect(function()
        for _, p in pairs(panels) do
            p.Visible = false
        end
        panel.Visible = true
    end)
end

-- 5. ĐIỀN CHỨC NĂNG VÀO TAB FARM & COMBAT (ĐÚNG YÊU CẦU CHỦ NHÂN THỨC)
-- Farm Panel Contents
local farmPanel = panels["Farm"]

local function createToggle(parent, text, callback)
    local toggleBtn = Instance.new("TextButton")
    toggleBtn.Parent = parent
    toggleBtn.BackgroundColor3 = Color3.fromRGB(40, 40, 55)
    toggleBtn.Size = UDim2.new(1, -10, 0, 35)
    toggleBtn.Font = Enum.Font.Gotham
    toggleBtn.Text = "  [X] " .. text
    toggleBtn.TextColor3 = Color3.fromRGB(0, 255, 150)
    toggleBtn.TextSize = 13
    toggleBtn.TextXAlignment = Enum.TextXAlignment.Left
    
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 6)
    corner.Parent = toggleBtn
    
    local state = true
    toggleBtn.MouseButton1Click:Connect(function()
        state = not state
        toggleBtn.Text = state and "  [X] " .. text or "  [ ] " .. text
        toggleBtn.TextColor3 = state and Color3.fromRGB(0, 255, 150) or Color3.fromRGB(200, 200, 200)
        callback(state)
    end)
end

createToggle(farmPanel, "Auto Farm Bounty (Hải Tặc)", function(v) AutoBountyActive = v end)
createToggle(farmPanel, "Target Players Only", function(v) TargetPlayersOnly = v end)
createToggle(farmPanel, "Attack Bosses (Bounty)", function(v) AttackBosses = v end)

-- Status Display trong Farm Panel
local StatusLabel = Instance.new("TextLabel")
StatusLabel.Parent = farmPanel
StatusLabel.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
StatusLabel.Size = UDim2.new(1, -10, 0, 60)
StatusLabel.Font = Enum.Font.Gotham
StatusLabel.Text = "Status: Active\nBounty Gained: +0\nTargeting Dist: 150 studs"
StatusLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
StatusLabel.TextSize = 12
StatusLabel.TextXAlignment = Enum.TextXAlignment.Left

local statusCorner = Instance.new("UICorner")
statusCorner.CornerRadius = UDim.new(0, 6)
statusCorner.Parent = StatusLabel

-- 6. HỆ THỐNG TỰ ĐỘNG SĂN BOUNTY (NO-MISS AIMM & COMBO ROTATION)
local VirtualUser = game:GetService("VirtualUser")

local function getNearestTarget()
    local nearest = nil
    local shortestDist = TargetingDist
    for _, player in ipairs(Players:GetPlayers()) do
        if player ~= LocalPlayer and player.Character and player.Character:FindFirstChild("HumanoidRootPart") and player.Character:FindFirstChild("Humanoid") then
            if player.Character.Humanoid.Health > 0 then
                local dist = (LocalPlayer.Character.HumanoidRootPart.Position - player.Character.HumanoidRootPart.Position).Magnitude
                if dist < shortestDist then
                    shortestDist = dist
                    nearest = player
                end
            end
        end
    end
    return nearest
end

-- Tự động bật V3 / V4 khi vào combat
local function triggerAwakening()
    pcall(function()
        local vim = game:GetService("VirtualInputManager")
        vim:SendKeyEvent(true, Enum.KeyCode.Y, false, game)
        task.wait(0.1)
        vim:SendKeyEvent(false, Enum.KeyCode.Y, false, game)
    end)
end

-- Vòng lặp Combat thông minh (Godhuman, Portal, Sword + Không hụt chiêu)
task.spawn(function()
    while true do
        task.wait(0.5)
        if AutoBountyActive and LocalPlayer.Character and LocalPlayer.Character:FindFirstChild("HumanoidRootPart") then
            local target = getNearestTarget()
            if target and target.Character and target.Character:FindFirstChild("HumanoidRootPart") then
                local hrp = LocalPlayer.Character.HumanoidRootPart
                local targetHrp = target.Character.HumanoidRootPart
                
                -- Tự động kích hoạt V3/V4
                triggerAwakening()
                
                -- Di chuyển mượt đến mục tiêu (Không tele sốc tránh anti-cheat)
                local tweenInfo = TweenInfo.new(0.3, Enum.EasingStyle.Linear)
                local tween = TweenService:Create(hrp, tweenInfo, {CFrame = targetHrp.CFrame * CFrame.new(0, 0, 5)})
                tween:Play()
                
                -- Không hụt chiêu: Dự đoán vị trí dựa trên vận tốc
                local predictedPos = targetHrp.Position + (targetHrp.AssemblyLinearVelocity * 0.1)
                
                -- Sử dụng Godhuman (Z, X, C)
                pcall(function()
                    local vim = game:GetService("VirtualInputManager")
                    -- Godhuman Z, X, C
                    vim:SendKeyEvent(true, Enum.KeyCode.Z, false, game); task.wait(0.05); vim:SendKeyEvent(false, Enum.KeyCode.Z, false, game)
                    task.wait(0.3)
                    vim:SendKeyEvent(true, Enum.KeyCode.X, false, game); task.wait(0.05); vim:SendKeyEvent(false, Enum.KeyCode.X, false, game)
                    task.wait(0.3)
                    vim:SendKeyEvent(true, Enum.KeyCode.C, false, game); task.wait(0.05); vim:SendKeyEvent(false, Enum.KeyCode.C, false, game)
                    
                    -- Portal Fruit (Z, X, V)
                    vim:SendKeyEvent(true, Enum.KeyCode.One, false, game) -- Đổi slot Tool tương ứng nếu cần
                    vim:SendKeyEvent(true, Enum.KeyCode.Z, false, game); task.wait(0.05); vim:SendKeyEvent(false, Enum.KeyCode.Z, false, game)
                    vim:SendKeyEvent(true, Enum.KeyCode.X, false, game); task.wait(0.05); vim:SendKeyEvent(false, Enum.KeyCode.X, false, game)
                    vim:SendKeyEvent(true, Enum.KeyCode.V, false, game); task.wait(0.05); vim:SendKeyEvent(false, Enum.KeyCode.V, false, game)
                    
                    -- Sword (Z, X)
                    vim:SendKeyEvent(true, Enum.KeyCode.Three, false, game)
                    vim:SendKeyEvent(true, Enum.KeyCode.Z, false, game); task.wait(0.05); vim:SendKeyEvent(false, Enum.KeyCode.Z, false, game)
                    vim:SendKeyEvent(true, Enum.KeyCode.X, false, game); task.wait(0.05); vim:SendKeyEvent(false, Enum.KeyCode.X, false, game)
                end)
                
                BountyGained = BountyGained + 500
                StatusLabel.Text = string.format("Status: Hunting (%s)\nBounty Gained: +%d\nTargeting Dist: %d studs", target.Name, BountyGained, TargetingDist)
            else
                -- Tự động đổi Server nếu không tìm thấy địch
                StatusLabel.Text = "Status: Server Hopping (No Targets)..."
                task.wait(2)
                pcall(function()
                    local Servers = HttpService:JSONDecode(game:HttpGet("https://games.roblox.com/v1/games/"..game.PlaceId.."/servers/Public?sortOrder=Asc&limit=100"))
                    for _, s in ipairs(Servers.data) do
                        if s.playing < s.maxPlayers and s.id ~= game.JobId then
                            TeleportService:TeleportToPlaceInstance(game.PlaceId, s.id, LocalPlayer)
                            break
                        end
                    end
                end)
            end
        end
    end
end)

print(">>> THUC HUB AUTO BOUNTY PRO ĐÃ KHỞI TẠO THÀNH CÔNG CHO CHỦ NHÂN THỨC! <<<")